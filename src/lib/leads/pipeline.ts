import { searchAllOrgs, mapApolloOrg } from "./apollo";
import { domainSearch, mapHunterContact, getAccountUsage } from "./hunter";
import { generateResearch, generateOutreach } from "./claude";
import {
  getServiceClient,
  upsertCompany,
  upsertContact,
  getCompaniesByStatus,
  updateCompanyResearch,
  updateCompanyStatus,
  insertOutreachEmail,
  ensureSequenceForVertical,
  getPrimaryContactsForResearchedCompanies,
  logPipelineEvent,
  updateLeadJob,
} from "./db";

export type LeadCriteria = {
  industries?: string[];
  geo?: string[];
  revenue_ranges?: string[];
  employee_ranges?: string[];
  locations?: string[];
  icp_description?: string;
  outreach_config?: Record<string, unknown>;
};

export const DEFAULT_OUTREACH_CONFIG = {
  sequence_length: 3,
  tone: "sandler-pain",
  offer_angle: "operational efficiency through AI/automation",
  stress_test: "What does it cost when this gets messy?",
  physical_address: "Charlotte, NC",
  opt_out_text: "Reply 'no thanks' and I'll stop.",
};

const PROMPT_VERSION = "v1";

// Decision-maker keywords for role classification
const DM_TITLES = [
  "vp", "vice president", "director", "chief", "ceo", "coo", "cfo", "cto",
  "president", "owner", "founder", "partner", "head of", "general manager",
  "estimat", "preconstruction",
];

function isDecisionMaker(title: string | null, seniority: string | null): boolean {
  if (!title && !seniority) return false;
  const t = (title ?? "").toLowerCase();
  const s = (seniority ?? "").toLowerCase();
  return DM_TITLES.some((kw) => t.includes(kw)) || s === "executive" || s === "director";
}

/**
 * Heuristic 0-100 lead score, matching the niewdel.com /lab demo bands:
 *   85+  = green/high-confidence
 *   <85  = amber
 *
 * Breakdown (max 100):
 *  - role_type == decision_maker → 40
 *  - email verified              → 20
 *  - company has a headcount     → 20
 *  - company has tech / keywords → 20
 */
function computeLeadScore(args: {
  roleType: string;
  emailVerified: boolean;
  headcount: number | null;
  technologies: string[] | null;
}): number {
  let score = 0;
  if (args.roleType === "decision_maker") score += 40;
  else if (args.roleType === "influencer") score += 20;
  if (args.emailVerified) score += 20;
  if (typeof args.headcount === "number" && args.headcount > 0) score += 20;
  if (args.technologies && args.technologies.length > 0) score += 20;
  return Math.min(100, score);
}

/**
 * Run the full lead generation pipeline for a job.
 * Reports progress back to the lead_jobs row at every stage transition.
 * Returns when complete or throws on irrecoverable error.
 */
export async function runPipeline(jobId: string): Promise<void> {
  const sb = getServiceClient();

  // Load job + vertical
  const { data: job, error: jobErr } = await sb
    .from("lead_jobs")
    .select("*")
    .eq("id", jobId)
    .single();
  if (jobErr || !job) throw new Error(`Job not found: ${jobId}`);

  if (!job.vertical_id) throw new Error("Job has no vertical_id");
  const { data: vertical } = await sb
    .from("verticals")
    .select("*")
    .eq("id", job.vertical_id)
    .single();
  if (!vertical) throw new Error(`Vertical not found: ${job.vertical_id}`);

  const criteria = (job.criteria ?? {}) as LeadCriteria;
  const target = job.target_count ?? 25;
  const orgId = job.org_id as string;

  await updateLeadJob(jobId, {
    status: "scraping",
    current_stage: "Searching companies via Apollo",
    progress_pct: 5,
    started_at: new Date().toISOString(),
  });

  // ============================================================
  // Stage 1: SCRAPE — Apollo org search + ICP filter
  // ============================================================
  const apolloFilters = (vertical.scrape_params?.apollo_filters ?? {}) as Record<string, string[] | undefined>;
  const apolloParams = {
    organization_revenue_ranges:
      apolloFilters.organization_revenue_ranges ?? criteria.revenue_ranges,
    organization_num_employees_ranges:
      apolloFilters.organization_num_employees_ranges ?? criteria.employee_ranges,
    organization_locations:
      apolloFilters.organization_locations ?? criteria.locations,
    q_organization_keyword_tags:
      apolloFilters.q_organization_keyword_tags ?? criteria.industries,
  };

  const rawOrgs = await searchAllOrgs(apolloParams, target * 5);

  // Geo filter is handled server-side by Apollo's organization_locations
  // param, so we trust Apollo's results here. (The previous local check
  // failed to match "CA" against "California" and rejected valid orgs.)
  const targetIndustries = (criteria.industries ?? []).map((i) => i.toLowerCase());

  const filtered = rawOrgs
    .filter((o) => {
      if (!o.primary_domain) return false;
      if (targetIndustries.length) {
        const industry = (o.industry ?? "").toLowerCase();
        const keywords = (o.keywords ?? []).map((k) => k.toLowerCase());
        const allText = [industry, ...keywords].join(" ");
        if (!targetIndustries.some((i) => allText.includes(i))) return false;
      }
      return true;
    })
    .slice(0, target);

  if (filtered.length === 0) {
    await updateLeadJob(jobId, {
      status: "failed",
      error: `Apollo returned ${rawOrgs.length} orgs but none matched the ICP (industry/geo). Loosen the criteria and try again.`,
      completed_at: new Date().toISOString(),
    });
    return;
  }

  // Upsert companies. Keep the mapped enrichment alongside the id so the
  // contact-scoring pass below can reference headcount + technologies.
  type CompanyEntry = {
    id: string;
    headcount: number | null;
    technologies: string[];
  };
  const companyMap = new Map<string, CompanyEntry>();
  for (const apolloOrg of filtered) {
    const mapped = mapApolloOrg(apolloOrg);
    if (!mapped.domain) continue;
    try {
      const company = await upsertCompany({
        org_id: orgId,
        vertical_id: vertical.id,
        ...mapped,
      });
      companyMap.set(mapped.domain, {
        id: (company as { id: string }).id,
        headcount: mapped.headcount,
        technologies: mapped.technologies,
      });
    } catch {
      // continue on per-row failure
    }
  }

  await updateLeadJob(jobId, {
    status: "enriching",
    current_stage: `Found ${companyMap.size} companies. Looking up contacts via Hunter...`,
    progress_pct: 15,
    companies_found: companyMap.size,
  });

  // ============================================================
  // Stage 2: ENRICH — Hunter domain search per company
  // ============================================================
  const usage = await getAccountUsage();
  const searchesLeft = usage.searches.available - usage.searches.used;

  if (searchesLeft <= 0) {
    await updateLeadJob(jobId, {
      status: "failed",
      error:
        "No Hunter.io searches remaining this month. Companies were saved but contacts could not be fetched.",
      completed_at: new Date().toISOString(),
    });
    return;
  }

  // Hunter filters: per-vertical override via scrape_params.hunter_filters, else
  // a permissive default (seniority only). The previous hard-coded department
  // list ("executive,engineering,operations") quietly returned zero contacts
  // for SMB / trades verticals where Hunter has no department tagging.
  const hunterFilters = (vertical.scrape_params?.hunter_filters ?? {}) as {
    seniority?: string[];
    department?: string[];
  };
  const seniority = hunterFilters.seniority ?? ["senior", "executive"];
  const department = hunterFilters.department;

  const domainsToSearch = [...companyMap.keys()].slice(0, searchesLeft);
  let contactsCount = 0;

  for (let i = 0; i < domainsToSearch.length; i++) {
    const domain = domainsToSearch[i];
    const company = companyMap.get(domain);
    if (!company) continue;

    try {
      const result = await domainSearch(domain, {
        limit: 10,
        seniority,
        ...(department && department.length ? { department } : {}),
      });

      let isPrimarySet = false;
      for (const hunterEmail of result.emails) {
        const mapped = mapHunterContact(hunterEmail);
        if (!mapped.email) continue;
        const roleType = isDecisionMaker(mapped.title, mapped.seniority)
          ? "decision_maker"
          : "influencer";
        const lead_score = computeLeadScore({
          roleType,
          emailVerified: mapped.email_verified,
          headcount: company.headcount,
          technologies: company.technologies,
        });
        await upsertContact({
          org_id: orgId,
          company_id: company.id,
          full_name: mapped.full_name,
          first_name: mapped.first_name,
          last_name: mapped.last_name,
          title: mapped.title,
          email: mapped.email,
          email_verified: mapped.email_verified,
          linkedin_url: mapped.linkedin_url,
          phone: mapped.phone,
          source: "hunter",
          source_id: mapped.source_id,
          role_type: roleType,
          is_primary: !isPrimarySet && roleType === "decision_maker",
          lead_score,
        });
        if (!isPrimarySet && roleType === "decision_maker") isPrimarySet = true;
        contactsCount++;
      }

      // Fallback primary if no decision maker found
      if (!isPrimarySet && result.emails.length > 0) {
        const first = mapHunterContact(result.emails[0]);
        if (first.email) {
          const lead_score = computeLeadScore({
            roleType: "unknown",
            emailVerified: first.email_verified,
            headcount: company.headcount,
            technologies: company.technologies,
          });
          await upsertContact({
            org_id: orgId,
            company_id: company.id,
            full_name: first.full_name,
            first_name: first.first_name,
            last_name: first.last_name,
            title: first.title,
            email: first.email,
            email_verified: first.email_verified,
            linkedin_url: first.linkedin_url,
            phone: first.phone,
            source: "hunter",
            role_type: "unknown",
            is_primary: true,
            lead_score,
          });
        }
      }

      await logPipelineEvent({
        org_id: orgId,
        company_id: company.id,
        event_type: "scraped",
        metadata: {
          sources: ["apollo", "hunter"],
          contacts_found: result.emails.length,
        },
      });

      await sleep(500); // Hunter rate limit
    } catch {
      // continue
    }

    // progress 15% -> 45% across enrichment
    const pct = 15 + Math.round((30 * (i + 1)) / domainsToSearch.length);
    await updateLeadJob(jobId, {
      progress_pct: pct,
      current_stage: `Enriching ${i + 1}/${domainsToSearch.length}: ${domain}`,
      contacts_found: contactsCount,
    });
  }

  // ============================================================
  // Stage 3: RESEARCH — Claude research per company
  // ============================================================
  const newCompanies = await getCompaniesByStatus(vertical.id, "new");

  await updateLeadJob(jobId, {
    status: "researching",
    current_stage: `Researching ${newCompanies.length} companies via Claude...`,
    progress_pct: 50,
  });

  for (let i = 0; i < newCompanies.length; i++) {
    const company = newCompanies[i];
    try {
      const { profile, summary } = await generateResearch(
        company.name,
        company.domain,
        company.industry,
        company.city && company.state ? `${company.city}, ${company.state}` : null,
        company.headcount,
        company.revenue_range
      );
      await updateCompanyResearch(company.id, profile, summary);
      await logPipelineEvent({
        org_id: orgId,
        company_id: company.id,
        event_type: "researched",
        metadata: { profile_keys: Object.keys(profile) },
      });
    } catch {
      // continue
    }

    // progress 50% -> 75%
    const pct = 50 + Math.round((25 * (i + 1)) / Math.max(newCompanies.length, 1));
    await updateLeadJob(jobId, {
      progress_pct: pct,
      current_stage: `Researching ${i + 1}/${newCompanies.length}: ${company.name}`,
    });
  }

  // ============================================================
  // Stage 4: WRITE — Claude email drafts per primary contact
  // ============================================================
  const sequence = await ensureSequenceForVertical(vertical.id, orgId);
  const contacts = await getPrimaryContactsForResearchedCompanies(vertical.id);
  const outreachConfig = {
    ...DEFAULT_OUTREACH_CONFIG,
    ...(vertical.outreach_config ?? {}),
    ...(criteria.outreach_config ?? {}),
  };

  await updateLeadJob(jobId, {
    status: "writing",
    current_stage: `Drafting emails for ${contacts.length} contacts...`,
    progress_pct: 75,
  });

  let emailsCount = 0;
  for (let i = 0; i < contacts.length; i++) {
    const contact = contacts[i];
    const company = (contact as { companies?: { id: string; name: string; research_summary: string | null } }).companies;
    if (!company) continue;
    try {
      const emails = await generateOutreach(
        company.research_summary ?? "",
        contact.first_name ?? contact.full_name,
        contact.title ?? "",
        outreachConfig
      );

      for (const email of emails) {
        await insertOutreachEmail({
          org_id: orgId,
          contact_id: contact.id,
          sequence_id: sequence.id,
          step_number: email.step,
          subject: email.subject,
          body_plain: email.body,
          status: "draft",
          generated_by: "claude",
          prompt_version: PROMPT_VERSION,
        });
        emailsCount++;
      }
      await updateCompanyStatus(company.id, "outreach_ready");
      await logPipelineEvent({
        org_id: orgId,
        company_id: company.id,
        contact_id: contact.id,
        event_type: "email_generated",
        metadata: { emails_count: emails.length, prompt_version: PROMPT_VERSION },
      });
    } catch {
      // continue
    }

    const pct = 75 + Math.round((25 * (i + 1)) / Math.max(contacts.length, 1));
    await updateLeadJob(jobId, {
      progress_pct: pct,
      current_stage: `Drafting ${i + 1}/${contacts.length}: ${contact.full_name}`,
      emails_drafted: emailsCount,
    });
  }

  // ============================================================
  // Done
  // ============================================================
  await updateLeadJob(jobId, {
    status: "complete",
    progress_pct: 100,
    current_stage: `Done. ${companyMap.size} companies, ${contactsCount} contacts, ${emailsCount} email drafts.`,
    emails_drafted: emailsCount,
    contacts_found: contactsCount,
    completed_at: new Date().toISOString(),
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
