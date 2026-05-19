import { NextRequest, NextResponse } from "next/server";
import { getPipelineClient, getDefaultPipelineWorkspaceId } from "@/lib/pipeline/db";
import { DEAL_STAGES, type DealStage } from "@/types/pipeline";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = getPipelineClient();
  const workspace_id = await getDefaultPipelineWorkspaceId();

  const { data, error } = await sb
    .from("crm_deals")
    .select(
      "*, company:crm_companies(id, name, domain, website, industry, headcount, hq, notes), contact:crm_contacts(id, full_name, title, email, phone, linkedin_url, notes)"
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
  const sb = getPipelineClient();
  const workspace_id = await getDefaultPipelineWorkspaceId();
  const body = await req.json();

  const patch: Record<string, unknown> = {};
  for (const k of ["title", "value_cents", "close_date_est", "notes", "owner", "lost_reason", "position", "crm_company_id", "primary_contact_id"] as const) {
    if (k in body) patch[k] = body[k];
  }
  if ("stage" in body) {
    if (!DEAL_STAGES.includes(body.stage as DealStage)) {
      return NextResponse.json({ error: `Invalid stage: ${body.stage}` }, { status: 400 });
    }
    patch.stage = body.stage;
  }

  const { data, error } = await sb
    .from("crm_deals")
    .update(patch)
    .eq("workspace_id", workspace_id)
    .eq("id", id)
    .select(
      "*, company:crm_companies(id, name, domain, industry), contact:crm_contacts(id, full_name, title, email, phone)"
    )
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = getPipelineClient();
  const workspace_id = await getDefaultPipelineWorkspaceId();

  const { error } = await sb.from("crm_deals").delete().eq("workspace_id", workspace_id).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
