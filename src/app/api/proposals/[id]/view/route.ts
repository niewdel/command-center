// src/app/api/proposals/[id]/view/route.ts
//
// PUBLIC, token-gated: called once by <AcceptancePanel> on mount to log
// that the client opened the proposal. Verifies the proposal token before
// touching any data (middleware allows the whole /api/proposals/* prefix
// through unauthenticated on the assumption every handler here self-verifies).
//
// Idempotent status transition: only flips status -> 'viewed' and stamps
// viewed_at when the proposal is currently 'sent'. A proposal that has
// already progressed past that (viewed again, signed, etc) never gets
// downgraded. The `viewed` audit event itself is still appended every time
// this fires, since knowing the client reopened a signed proposal is useful
// history, not something that needs deduping.

import { NextRequest, NextResponse } from "next/server";
import { getPipelineClient, getDefaultPipelineWorkspaceId } from "@/lib/pipeline/db";
import { verifyProposalToken } from "@/lib/proposals/token";

export const dynamic = "force-dynamic";

function getClientIp(req: NextRequest): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (!fwd) return null;
  return fwd.split(",")[0]?.trim() || null;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const token = typeof body.token === "string" ? body.token : "";

  if (!verifyProposalToken(id, token)) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 401 });
  }

  const sb = getPipelineClient();
  const workspace_id = await getDefaultPipelineWorkspaceId();

  const { data: proposal } = await sb
    .from("crm_proposals")
    .select("id, status")
    .eq("workspace_id", workspace_id)
    .eq("id", id)
    .maybeSingle();

  if (!proposal) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 401 });
  }

  if (proposal.status === "sent") {
    await sb
      .from("crm_proposals")
      .update({ status: "viewed", viewed_at: new Date().toISOString() })
      .eq("workspace_id", workspace_id)
      .eq("id", id);
  }

  await sb.from("crm_proposal_events").insert({
    workspace_id,
    proposal_id: id,
    type: "viewed",
    ip: getClientIp(req),
    user_agent: req.headers.get("user-agent"),
    meta: {},
  });

  return NextResponse.json({ ok: true });
}
