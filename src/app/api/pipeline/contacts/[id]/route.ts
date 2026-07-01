import { NextRequest, NextResponse } from "next/server";
import { getUserScopedClient, resolveActiveWorkspace } from "@/lib/tenancy";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ws = await resolveActiveWorkspace();
  if (!ws) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sb = await getUserScopedClient();
  const workspace_id = ws.id;

  const { data, error } = await sb
    .from("crm_contacts")
    .select(
      `*,
      company:crm_companies(id, name, domain, website, industry, hq),
      deals:crm_deal_contacts(role, created_at, deal:crm_deals(id, title, stage, value_cents, close_date_est, next_action_at, probability, primary_contact_id))`
    )
    .eq("workspace_id", workspace_id)
    .eq("id", id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ data });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ws = await resolveActiveWorkspace();
  if (!ws) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sb = await getUserScopedClient();
  const workspace_id = ws.id;
  const body = await req.json();

  const patch: Record<string, unknown> = {};
  for (const k of ["full_name", "first_name", "last_name", "title", "email", "phone", "linkedin_url", "notes", "crm_company_id"] as const) {
    if (k in body) patch[k] = body[k];
  }

  const { data, error } = await sb
    .from("crm_contacts")
    .update(patch)
    .eq("workspace_id", workspace_id)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ws = await resolveActiveWorkspace();
  if (!ws) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sb = await getUserScopedClient();
  const workspace_id = ws.id;

  const { error } = await sb.from("crm_contacts").delete().eq("workspace_id", workspace_id).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
