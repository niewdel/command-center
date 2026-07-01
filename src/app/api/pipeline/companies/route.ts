import { NextRequest, NextResponse } from "next/server";
import { getUserScopedClient, resolveActiveWorkspace } from "@/lib/tenancy";

export const dynamic = "force-dynamic";

export async function GET() {
  const ws = await resolveActiveWorkspace();
  if (!ws) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sb = await getUserScopedClient();
  const workspace_id = ws.id;

  const { data, error } = await sb
    .from("crm_companies")
    .select("*, contacts:crm_contacts(count), deals:crm_deals(id, value_cents, stage)")
    .eq("workspace_id", workspace_id)
    .order("name", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}

export async function POST(req: NextRequest) {
  const ws = await resolveActiveWorkspace();
  if (!ws) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sb = await getUserScopedClient();
  const workspace_id = ws.id;
  const body = await req.json();
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const { data, error } = await sb
    .from("crm_companies")
    .insert({
      workspace_id,
      name: body.name.trim(),
      domain: body.domain || null,
      website: body.website || null,
      industry: body.industry || null,
      headcount: body.headcount ?? null,
      hq: body.hq || null,
      notes: body.notes || null,
      owner: body.owner || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
