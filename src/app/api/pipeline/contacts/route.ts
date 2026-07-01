import { NextRequest, NextResponse } from "next/server";
import { getUserScopedClient, resolveActiveWorkspace } from "@/lib/tenancy";

export const dynamic = "force-dynamic";

export async function GET() {
  const ws = await resolveActiveWorkspace();
  if (!ws) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sb = await getUserScopedClient();
  const workspace_id = ws.id;

  const { data, error } = await sb
    .from("crm_contacts")
    .select(
      "*, company:crm_companies(id, name, domain, industry), deals:crm_deals!crm_deals_primary_contact_id_fkey(id, stage, value_cents)"
    )
    .eq("workspace_id", workspace_id)
    .order("full_name", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}

export async function POST(req: NextRequest) {
  const ws = await resolveActiveWorkspace();
  if (!ws) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sb = await getUserScopedClient();
  const workspace_id = ws.id;
  const body = await req.json();
  if (!body.full_name?.trim()) {
    return NextResponse.json({ error: "full_name is required" }, { status: 400 });
  }

  const parts = body.full_name.trim().split(/\s+/);
  const first_name = body.first_name ?? parts[0] ?? null;
  const last_name = body.last_name ?? (parts.slice(1).join(" ") || null);

  const { data, error } = await sb
    .from("crm_contacts")
    .insert({
      workspace_id,
      full_name: body.full_name.trim(),
      first_name,
      last_name,
      title: body.title || null,
      email: body.email || null,
      phone: body.phone || null,
      linkedin_url: body.linkedin_url || null,
      notes: body.notes || null,
      crm_company_id: body.crm_company_id || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
