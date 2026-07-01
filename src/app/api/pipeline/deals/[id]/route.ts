import { NextRequest, NextResponse } from "next/server";
import { getPipelineClient, getDefaultPipelineWorkspaceId } from "@/lib/pipeline/db";
import { DEAL_STAGES, type DealStage } from "@/types/pipeline";
import { buildStageChangeBody } from "@/lib/pipeline/stale";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = getPipelineClient();
  const workspace_id = await getDefaultPipelineWorkspaceId();

  const { data, error } = await sb
    .from("crm_deals")
    .select(
      `*,
      company:crm_companies(id, name, domain, website, industry, headcount, hq, notes),
      contact:crm_contacts!crm_deals_primary_contact_id_fkey(id, full_name, title, email, phone, linkedin_url, notes),
      contacts:crm_deal_contacts(role, created_at, contact:crm_contacts(id, full_name, title, email, phone, linkedin_url, company:crm_companies(id, name)))`
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
  for (const k of ["title", "value_cents", "close_date_est", "notes", "owner", "lost_reason", "position", "crm_company_id", "primary_contact_id", "proposal_url", "proposal_filename", "fathom_url", "next_action_at", "probability"] as const) {
    if (k in body) patch[k] = body[k];
  }

  let previousStage: DealStage | null = null;
  if ("stage" in body) {
    if (!DEAL_STAGES.includes(body.stage as DealStage)) {
      return NextResponse.json({ error: `Invalid stage: ${body.stage}` }, { status: 400 });
    }
    patch.stage = body.stage;

    // Fetch the current stage so we can auto-log a stage_change activity
    // once the update succeeds. Skipped if the stage isn't actually
    // changing (no-op patch, e.g. re-saving the same stage).
    const { data: current } = await sb
      .from("crm_deals")
      .select("stage")
      .eq("workspace_id", workspace_id)
      .eq("id", id)
      .maybeSingle();
    previousStage = (current?.stage as DealStage | undefined) ?? null;
  }

  const { data, error } = await sb
    .from("crm_deals")
    .update(patch)
    .eq("workspace_id", workspace_id)
    .eq("id", id)
    .select(
      "*, company:crm_companies(id, name, domain, industry), contact:crm_contacts!crm_deals_primary_contact_id_fkey(id, full_name, title, email, phone)"
    )
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (previousStage && data && previousStage !== (patch.stage as DealStage)) {
    await sb.from("crm_activities").insert({
      workspace_id,
      deal_id: id,
      type: "stage_change",
      body: buildStageChangeBody(previousStage, patch.stage as DealStage),
      occurred_at: new Date().toISOString(),
    });
  }

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
