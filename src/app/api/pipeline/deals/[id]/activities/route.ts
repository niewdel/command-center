import { NextRequest, NextResponse } from "next/server";
import { getPipelineClient, getDefaultPipelineWorkspaceId } from "@/lib/pipeline/db";
import { ACTIVITY_TYPES, type ActivityType } from "@/types/pipeline";

export const dynamic = "force-dynamic";

/** Types a user can log by hand. `stage_change` is server-generated only. */
const LOGGABLE_ACTIVITY_TYPES: ActivityType[] = ACTIVITY_TYPES.filter((t) => t !== "stage_change");

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = getPipelineClient();
  const workspace_id = await getDefaultPipelineWorkspaceId();

  const { data, error } = await sb
    .from("crm_activities")
    .select("*")
    .eq("workspace_id", workspace_id)
    .eq("deal_id", id)
    .order("occurred_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = getPipelineClient();
  const workspace_id = await getDefaultPipelineWorkspaceId();
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

  // Confirm the deal exists in this workspace before attaching an activity.
  const { data: deal } = await sb
    .from("crm_deals")
    .select("id")
    .eq("workspace_id", workspace_id)
    .eq("id", id)
    .maybeSingle();
  if (!deal) return NextResponse.json({ error: "Deal not found" }, { status: 404 });

  const { data, error } = await sb
    .from("crm_activities")
    .insert({
      workspace_id,
      deal_id: id,
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
