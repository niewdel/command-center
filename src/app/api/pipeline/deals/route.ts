import { NextRequest, NextResponse } from "next/server";
import { getUserScopedClient, resolveActiveWorkspace } from "@/lib/tenancy";
import { DEAL_STAGES, type DealStage } from "@/types/pipeline";

export const dynamic = "force-dynamic";

export async function GET() {
  const ws = await resolveActiveWorkspace();
  if (!ws) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sb = await getUserScopedClient();
  const workspace_id = ws.id;

  const { data, error } = await sb
    .from("crm_deals")
    .select(
      `*,
      company:crm_companies(id, name, domain, industry),
      contact:crm_contacts!crm_deals_primary_contact_id_fkey(id, full_name, title, email, phone),
      contact_count:crm_deal_contacts(count)`
    )
    .eq("workspace_id", workspace_id)
    .order("position", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}

export async function POST(req: NextRequest) {
  const ws = await resolveActiveWorkspace();
  if (!ws) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sb = await getUserScopedClient();
  const workspace_id = ws.id;
  const body = await req.json();

  const stage = (body.stage ?? "discovery") as DealStage;
  if (!DEAL_STAGES.includes(stage)) {
    return NextResponse.json({ error: `Invalid stage: ${stage}` }, { status: 400 });
  }
  if (!body.title?.trim()) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  const { data, error } = await sb
    .from("crm_deals")
    .insert({
      workspace_id,
      title: body.title.trim(),
      stage,
      crm_company_id: body.crm_company_id ?? null,
      primary_contact_id: body.primary_contact_id ?? null,
      value_cents: body.value_cents ?? null,
      close_date_est: body.close_date_est ?? null,
      notes: body.notes ?? null,
      owner: body.owner ?? null,
    })
    .select(
      `*,
      company:crm_companies(id, name, domain, industry),
      contact:crm_contacts!crm_deals_primary_contact_id_fkey(id, full_name, title, email, phone)`
    )
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Seed the join table with the primary contact so /api/pipeline/deals/[id]
  // returns consistent contacts on first fetch.
  if (data?.primary_contact_id) {
    await sb
      .from("crm_deal_contacts")
      .upsert(
        { deal_id: data.id, contact_id: data.primary_contact_id, role: "Primary" },
        { onConflict: "deal_id,contact_id" }
      );
  }

  return NextResponse.json({ data });
}
