import { NextRequest, NextResponse } from "next/server";
import { getPipelineClient, getDefaultPipelineWorkspaceId } from "@/lib/pipeline/db";

export const dynamic = "force-dynamic";

/**
 * POST /api/pipeline/promote
 * Body: { prospect_contact_id: string, deal_title?: string }
 *
 * Idempotently copies the prospect's company + contact into the Niewdel CRM
 * (dedupes on source_prospect_*_id) and creates a new deal in stage
 * "discovery". Returns the new deal id so the client can route to detail.
 */
export async function POST(req: NextRequest) {
  const sb = getPipelineClient();
  const workspace_id = await getDefaultPipelineWorkspaceId();
  const body = await req.json();
  const prospectContactId = body.prospect_contact_id as string | undefined;

  if (!prospectContactId) {
    return NextResponse.json({ error: "prospect_contact_id is required" }, { status: 400 });
  }

  // Pull source prospect + its company
  const { data: prospect, error: pErr } = await sb
    .from("contacts")
    .select(
      "id, full_name, first_name, last_name, title, email, phone, linkedin_url, companies(id, name, domain, website, industry, headcount, city, state)"
    )
    .eq("id", prospectContactId)
    .single();

  if (pErr || !prospect) {
    return NextResponse.json({ error: "Prospect not found" }, { status: 404 });
  }

  const sourceCompany = prospect.companies as unknown as
    | {
        id: string;
        name: string;
        domain: string | null;
        website: string | null;
        industry: string | null;
        headcount: number | null;
        city: string | null;
        state: string | null;
      }
    | null;

  // --- 1. Upsert CRM company (dedupe by source id, then by domain) ---
  let crmCompanyId: string | null = null;
  if (sourceCompany) {
    const { data: existingById } = await sb
      .from("crm_companies")
      .select("id")
      .eq("workspace_id", workspace_id)
      .eq("source_prospect_company_id", sourceCompany.id)
      .maybeSingle();
    if (existingById) {
      crmCompanyId = existingById.id;
    } else if (sourceCompany.domain) {
      const { data: existingByDomain } = await sb
        .from("crm_companies")
        .select("id")
        .eq("workspace_id", workspace_id)
        .eq("domain", sourceCompany.domain)
        .maybeSingle();
      if (existingByDomain) {
        crmCompanyId = existingByDomain.id;
        // Link the source for next time
        await sb
          .from("crm_companies")
          .update({ source_prospect_company_id: sourceCompany.id })
          .eq("id", existingByDomain.id);
      }
    }

    if (!crmCompanyId) {
      const hq = [sourceCompany.city, sourceCompany.state].filter(Boolean).join(", ") || null;
      const { data: newCompany, error: cErr } = await sb
        .from("crm_companies")
        .insert({
          workspace_id,
          name: sourceCompany.name,
          domain: sourceCompany.domain,
          website: sourceCompany.website,
          industry: sourceCompany.industry,
          headcount: sourceCompany.headcount,
          hq,
          source_prospect_company_id: sourceCompany.id,
        })
        .select("id")
        .single();
      if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });
      crmCompanyId = newCompany.id;
    }
  }

  // --- 2. Upsert CRM contact (dedupe by source id, then by email) ---
  let crmContactId: string | null = null;
  const { data: existingContactBySrc } = await sb
    .from("crm_contacts")
    .select("id")
    .eq("workspace_id", workspace_id)
    .eq("source_prospect_contact_id", prospect.id)
    .maybeSingle();
  if (existingContactBySrc) {
    crmContactId = existingContactBySrc.id;
  } else if (prospect.email) {
    const { data: existingByEmail } = await sb
      .from("crm_contacts")
      .select("id")
      .eq("workspace_id", workspace_id)
      .eq("email", prospect.email)
      .maybeSingle();
    if (existingByEmail) {
      crmContactId = existingByEmail.id;
      await sb
        .from("crm_contacts")
        .update({ source_prospect_contact_id: prospect.id })
        .eq("id", existingByEmail.id);
    }
  }

  if (!crmContactId) {
    const { data: newContact, error: ctErr } = await sb
      .from("crm_contacts")
      .insert({
        workspace_id,
        crm_company_id: crmCompanyId,
        full_name: prospect.full_name,
        first_name: prospect.first_name,
        last_name: prospect.last_name,
        title: prospect.title,
        email: prospect.email,
        phone: prospect.phone,
        linkedin_url: prospect.linkedin_url,
        source_prospect_contact_id: prospect.id,
      })
      .select("id")
      .single();
    if (ctErr) return NextResponse.json({ error: ctErr.message }, { status: 500 });
    crmContactId = newContact.id;
  }

  // --- 3. Create the deal ---
  const dealTitle = (body.deal_title?.trim() as string | undefined) ?? `${sourceCompany?.name ?? prospect.full_name}`;
  const { data: deal, error: dErr } = await sb
    .from("crm_deals")
    .insert({
      workspace_id,
      crm_company_id: crmCompanyId,
      primary_contact_id: crmContactId,
      title: dealTitle,
      stage: "discovery",
    })
    .select("id")
    .single();
  if (dErr) return NextResponse.json({ error: dErr.message }, { status: 500 });

  return NextResponse.json({
    deal_id: deal.id,
    crm_company_id: crmCompanyId,
    crm_contact_id: crmContactId,
  });
}
