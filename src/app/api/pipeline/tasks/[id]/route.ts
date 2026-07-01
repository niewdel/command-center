import { NextRequest, NextResponse } from "next/server";
import { getUserScopedClient, resolveActiveWorkspace } from "@/lib/tenancy";

export const dynamic = "force-dynamic";

const PATCHABLE_FIELDS = ["title", "due_date", "done", "deal_id", "crm_company_id", "contact_id"] as const;

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ws = await resolveActiveWorkspace();
  if (!ws) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sb = await getUserScopedClient();
  const workspace_id = ws.id;
  const body = await req.json();

  const patch: Record<string, unknown> = {};
  for (const k of PATCHABLE_FIELDS) {
    if (k in body) patch[k] = body[k];
  }
  if ("title" in patch && !String(patch.title).trim()) {
    return NextResponse.json({ error: "title cannot be empty" }, { status: 400 });
  }
  if ("title" in patch) patch.title = String(patch.title).trim();

  const { data: existing } = await sb
    .from("crm_tasks")
    .select("id")
    .eq("workspace_id", workspace_id)
    .eq("id", id)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data, error } = await sb
    .from("crm_tasks")
    .update(patch)
    .eq("workspace_id", workspace_id)
    .eq("id", id)
    .select("*")
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

  const { data: existing } = await sb
    .from("crm_tasks")
    .select("id")
    .eq("workspace_id", workspace_id)
    .eq("id", id)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { error } = await sb.from("crm_tasks").delete().eq("workspace_id", workspace_id).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
