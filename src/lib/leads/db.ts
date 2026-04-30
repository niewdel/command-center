import { createClient, SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function getServiceClient(): SupabaseClient {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error(
        "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
      );
    }
    client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

export async function getOrg() {
  const { data, error } = await getServiceClient()
    .from("organizations")
    .select("*")
    .limit(1)
    .single();
  if (error) throw new Error(`Failed to get org: ${error.message}`);
  return data;
}

export async function upsertCompany(company: {
  org_id: string;
  vertical_id: string;
  name: string;
  domain: string | null;
  website?: string | null;
  industry?: string | null;
  revenue_range?: string | null;
  headcount?: number | null;
  city?: string | null;
  state?: string | null;
  country?: string;
  source?: string;
  source_id?: string | null;
}) {
  const { data, error } = await getServiceClient()
    .from("companies")
    .upsert(company, { onConflict: "org_id,domain" })
    .select()
    .single();
  if (error) throw new Error(`Failed to upsert company: ${error.message}`);
  return data;
}

export async function getCompaniesByStatus(verticalId: string, status: string) {
  const { data, error } = await getServiceClient()
    .from("companies")
    .select("*")
    .eq("vertical_id", verticalId)
    .eq("status", status)
    .order("created_at");
  if (error) throw new Error(`Failed to get companies: ${error.message}`);
  return data;
}

export async function updateCompanyResearch(
  companyId: string,
  researchProfile: Record<string, unknown>,
  researchSummary: string
) {
  const { error } = await getServiceClient()
    .from("companies")
    .update({
      research_profile: researchProfile,
      research_summary: researchSummary,
      researched_at: new Date().toISOString(),
      status: "researched",
    })
    .eq("id", companyId);
  if (error) throw new Error(`Failed to update research: ${error.message}`);
}

export async function updateCompanyStatus(companyId: string, status: string) {
  const { error } = await getServiceClient()
    .from("companies")
    .update({ status })
    .eq("id", companyId);
  if (error) throw new Error(`Failed to update status: ${error.message}`);
}

export async function upsertContact(contact: {
  org_id: string;
  company_id: string;
  full_name: string;
  first_name?: string | null;
  last_name?: string | null;
  title?: string | null;
  email: string | null;
  email_verified?: boolean;
  linkedin_url?: string | null;
  role_type?: string;
  source?: string;
  source_id?: string | null;
  is_primary?: boolean;
}) {
  const { data, error } = await getServiceClient()
    .from("contacts")
    .upsert(contact, { onConflict: "org_id,email" })
    .select()
    .single();
  if (error) throw new Error(`Failed to upsert contact: ${error.message}`);
  return data;
}

export async function getPrimaryContactsForResearchedCompanies(verticalId: string) {
  const { data, error } = await getServiceClient()
    .from("contacts")
    .select("*, companies!inner(*)")
    .eq("companies.vertical_id", verticalId)
    .eq("companies.status", "researched")
    .eq("is_primary", true);
  if (error) throw new Error(`Failed to get contacts: ${error.message}`);
  return data;
}

export async function insertOutreachEmail(email: {
  org_id: string;
  contact_id: string;
  sequence_id?: string | null;
  step_number: number;
  subject: string;
  body_plain: string;
  status?: string;
  generated_by?: string;
  prompt_version?: string | null;
}) {
  const { data, error } = await getServiceClient()
    .from("outreach_emails")
    .insert(email)
    .select()
    .single();
  if (error) throw new Error(`Failed to insert email: ${error.message}`);
  return data;
}

export async function logPipelineEvent(event: {
  org_id: string;
  company_id?: string | null;
  contact_id?: string | null;
  event_type: string;
  metadata?: Record<string, unknown>;
}) {
  const { error } = await getServiceClient().from("pipeline_log").insert(event);
  if (error) throw new Error(`Failed to log event: ${error.message}`);
}

export async function ensureSequenceForVertical(verticalId: string, orgId: string) {
  const sb = getServiceClient();
  const { data: existing } = await sb
    .from("sequences")
    .select("*")
    .eq("vertical_id", verticalId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  if (existing) return existing;

  const { data, error } = await sb
    .from("sequences")
    .insert({
      org_id: orgId,
      vertical_id: verticalId,
      name: "Default 3-step sequence",
      steps: 3,
      delay_days: [0, 3, 5],
      is_active: true,
    })
    .select()
    .single();
  if (error) throw new Error(`Failed to create sequence: ${error.message}`);
  return data;
}

// -- lead_jobs --

export type LeadJobStatus =
  | "queued"
  | "scraping"
  | "enriching"
  | "researching"
  | "writing"
  | "complete"
  | "failed"
  | "cancelled";

export type LeadJobUpdate = Partial<{
  status: LeadJobStatus;
  current_stage: string;
  progress_pct: number;
  companies_found: number;
  contacts_found: number;
  emails_drafted: number;
  error: string;
  started_at: string;
  completed_at: string;
  last_heartbeat_at: string;
}>;

const NON_TERMINAL_STATUSES: LeadJobStatus[] = [
  "queued",
  "scraping",
  "enriching",
  "researching",
  "writing",
];

// Heartbeat staleness threshold. Pipeline writes happen every per-item tick
// (sub-second to ~10s during research/write stages), so 2 minutes is well
// outside normal jitter but tight enough that a dead worker fails fast.
export const LEAD_JOB_HEARTBEAT_TIMEOUT_MS = 2 * 60 * 1000;

export async function updateLeadJob(jobId: string, patch: LeadJobUpdate) {
  const { error } = await getServiceClient()
    .from("lead_jobs")
    .update({ last_heartbeat_at: new Date().toISOString(), ...patch })
    .eq("id", jobId);
  if (error) throw new Error(`Failed to update lead_job: ${error.message}`);
}

/**
 * Mark any non-terminal lead_jobs whose heartbeat is older than
 * LEAD_JOB_HEARTBEAT_TIMEOUT_MS as failed. Returns the swept ids.
 *
 * Safe to call concurrently — the WHERE clause filters by status, so a job
 * that finishes between the read and the write is naturally excluded.
 */
export async function sweepStaleLeadJobs(): Promise<string[]> {
  const cutoff = new Date(
    Date.now() - LEAD_JOB_HEARTBEAT_TIMEOUT_MS
  ).toISOString();
  const sb = getServiceClient();

  const { data, error } = await sb
    .from("lead_jobs")
    .update({
      status: "failed" as LeadJobStatus,
      error:
        "Worker process died mid-pipeline (no heartbeat). Re-run the job.",
      completed_at: new Date().toISOString(),
    })
    .in("status", NON_TERMINAL_STATUSES)
    .lt("last_heartbeat_at", cutoff)
    .select("id");

  if (error) throw new Error(`Failed to sweep lead_jobs: ${error.message}`);
  return (data ?? []).map((r) => r.id as string);
}
