// src/app/api/proposals/[id]/countersign/route.ts
//
// INTERNAL ONLY: sets Niewdel's countersignature on a dual-sign proposal
// (e.g. retainers) after the client has already signed. Runs inside the
// authenticated operator app (the pipeline builder) -- NEVER on a public
// client-facing link, so it deliberately does NOT check a proposal token.
//
// SECURITY NOTE: middleware.ts allows the entire /api/proposals/* prefix
// through unauthenticated, because every other handler under that prefix
// self-verifies via verifyProposalToken(). This route has no client token
// to verify, so it is the one exception in this directory and MUST check
// the operator's Supabase session itself instead -- otherwise it would be
// an open, unauthenticated write endpoint. Do not remove this check.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getPipelineClient, getDefaultPipelineWorkspaceId } from "@/lib/pipeline/db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const countersignerName =
    typeof body.countersignerName === "string" && body.countersignerName.trim()
      ? body.countersignerName.trim()
      : user.email ?? "Niewdel";

  const sb = getPipelineClient();
  const workspace_id = await getDefaultPipelineWorkspaceId();

  const { data: proposal } = await sb
    .from("crm_proposals")
    .select("id, status, countersigned_at")
    .eq("workspace_id", workspace_id)
    .eq("id", id)
    .maybeSingle();
  if (!proposal) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (proposal.status !== "signed") {
    return NextResponse.json(
      { error: "The client must sign before this proposal can be countersigned" },
      { status: 400 }
    );
  }
  if (proposal.countersigned_at) {
    return NextResponse.json({ error: "Already countersigned" }, { status: 409 });
  }

  const countersignedAt = new Date().toISOString();
  const { data: updated, error } = await sb
    .from("crm_proposals")
    .update({ countersigner_name: countersignerName, countersigned_at: countersignedAt })
    .eq("workspace_id", workspace_id)
    .eq("id", id)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await sb.from("crm_proposal_events").insert({
    workspace_id,
    proposal_id: id,
    type: "countersigned",
    actor: countersignerName,
    meta: {},
  });

  return NextResponse.json({ data: updated });
}
