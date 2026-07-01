import { NextRequest, NextResponse } from "next/server";
import { getPipelineClient, getDefaultPipelineWorkspaceId } from "@/lib/pipeline/db";
import { signProposalToken } from "@/lib/proposals/token";

export const dynamic = "force-dynamic";

/**
 * Returns the token-gated client view URL for a proposal. The HMAC token is
 * generated server-side only (signProposalToken uses PROPOSAL_VIEW_SECRET,
 * never sent to or derivable by the client) so the builder UI can show a
 * "copy link" affordance without ever exposing the signing secret.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = getPipelineClient();
  const workspace_id = await getDefaultPipelineWorkspaceId();

  const { data: proposal } = await sb
    .from("crm_proposals")
    .select("id")
    .eq("workspace_id", workspace_id)
    .eq("id", id)
    .maybeSingle();
  if (!proposal) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const token = signProposalToken(id);
  const origin = req.nextUrl.origin;
  const url = `${origin}/proposals/${id}/view?token=${token}`;

  return NextResponse.json({ url });
}
