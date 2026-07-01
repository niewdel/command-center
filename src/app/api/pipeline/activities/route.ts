import { NextRequest, NextResponse } from "next/server";
import { getUserScopedClient, resolveActiveWorkspace } from "@/lib/tenancy";
import { ACTIVITY_TYPES, type ActivityType } from "@/types/pipeline";

export const dynamic = "force-dynamic";

/** Types a user can log by hand. `stage_change` is server-generated only. */
const LOGGABLE_ACTIVITY_TYPES: ActivityType[] = ACTIVITY_TYPES.filter((t) => t !== "stage_change");

/**
 * General activity feed — lists activities scoped by deal, company, or
 * contact (any combination of query params). The deal-nested route at
 * `deals/[id]/activities` still exists for the deal detail page's original
 * call shape; this route backs the company/contact 360 pages (and can be
 * used deal-scoped too via `?deal_id=`).
 */
export async function GET(req: NextRequest) {
  const ws = await resolveActiveWorkspace();
  if (!ws) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sb = await getUserScopedClient();
  const workspace_id = ws.id;
  const { searchParams } = new URL(req.url);
  const dealId = searchParams.get("deal_id");
  const companyId = searchParams.get("crm_company_id");
  const contactId = searchParams.get("contact_id");

  let query = sb.from("crm_activities").select("*").eq("workspace_id", workspace_id);
  if (dealId) query = query.eq("deal_id", dealId);
  if (companyId) query = query.eq("crm_company_id", companyId);
  if (contactId) query = query.eq("contact_id", contactId);
  query = query.order("occurred_at", { ascending: false });

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}

export async function POST(req: NextRequest) {
  const ws = await resolveActiveWorkspace();
  if (!ws) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sb = await getUserScopedClient();
  const workspace_id = ws.id;
  const body = await req.json();

  const type = body.type as ActivityType;
  if (!LOGGABLE_ACTIVITY_TYPES.includes(type)) {
    return NextResponse.json(
      { error: `Invalid type: ${body.type}. Must be one of ${LOGGABLE_ACTIVITY_TYPES.join(", ")}` },
      { status: 400 }
    );
  }
  const text = typeof body.body === "string" ? body.body.trim() : "";
  if (!text) {
    return NextResponse.json({ error: "body is required" }, { status: 400 });
  }

  const dealId = typeof body.deal_id === "string" && body.deal_id ? body.deal_id : null;
  const companyId = typeof body.crm_company_id === "string" && body.crm_company_id ? body.crm_company_id : null;
  const contactId = typeof body.contact_id === "string" && body.contact_id ? body.contact_id : null;

  if (!dealId && !companyId && !contactId) {
    return NextResponse.json({ error: "One of deal_id, crm_company_id, contact_id is required" }, { status: 400 });
  }

  // Confirm every referenced entity belongs to this workspace before attaching.
  if (dealId) {
    const { data: deal } = await sb.from("crm_deals").select("id").eq("workspace_id", workspace_id).eq("id", dealId).maybeSingle();
    if (!deal) return NextResponse.json({ error: "Deal not found" }, { status: 404 });
  }
  if (companyId) {
    const { data: company } = await sb
      .from("crm_companies")
      .select("id")
      .eq("workspace_id", workspace_id)
      .eq("id", companyId)
      .maybeSingle();
    if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }
  if (contactId) {
    const { data: contact } = await sb
      .from("crm_contacts")
      .select("id")
      .eq("workspace_id", workspace_id)
      .eq("id", contactId)
      .maybeSingle();
    if (!contact) return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  }

  const { data, error } = await sb
    .from("crm_activities")
    .insert({
      workspace_id,
      deal_id: dealId,
      crm_company_id: companyId,
      contact_id: contactId,
      type,
      body: text,
      occurred_at:
        typeof body.occurred_at === "string" && body.occurred_at ? body.occurred_at : new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
