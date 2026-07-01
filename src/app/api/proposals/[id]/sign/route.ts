// src/app/api/proposals/[id]/sign/route.ts
//
// PUBLIC, token-gated: the client's "Sign and accept" action. Verifies the
// proposal token before touching any data. Never trusts client-supplied
// amounts or totals -- selections (`selectedOptions`) toggle is_selected on
// the persisted line items, then totals are ALWAYS recomputed server-side
// via computeTotals() from those persisted rows before being snapshotted.
//
// ESIGN/UETA intent-to-sign: this flow satisfies the US ESIGN Act and UETA
// requirements for intent to sign an electronic record without a separate
// e-sign vendor, via (1) an explicit consent checkbox (consent === true),
// (2) a typed legal name serving as the signature, (3) captured IP + user
// agent, (4) a server-generated timestamp (never client-supplied), and
// (5) an append-only `crm_proposal_events` audit row recording all of the
// above. See the update() call below.

import { NextRequest, NextResponse } from "next/server";
import { getPipelineClient, getDefaultPipelineWorkspaceId } from "@/lib/pipeline/db";
import { verifyProposalToken } from "@/lib/proposals/token";
import { computeTotals, formatCents } from "@/lib/proposals/pricing";
import type { CrmProposalLineItem } from "@/types/proposals";

/** Stages that are still pre-build; signing a proposal nudges the deal past them. */
const PRE_BUILD_STAGES = new Set(["discovery", "scope", "proposal"]);

export const dynamic = "force-dynamic";

type SelectedOption = { lineItemId: string; selected: boolean };

interface SignRequestBody {
  token?: unknown;
  signerName?: unknown;
  signerEmail?: unknown;
  consent?: unknown;
  selectedOptions?: unknown;
  signatureTyped?: unknown;
}

function getClientIp(req: NextRequest): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (!fwd) return null;
  return fwd.split(",")[0]?.trim() || null;
}

function parseSelectedOptions(input: unknown): SelectedOption[] {
  if (!Array.isArray(input)) return [];
  const out: SelectedOption[] = [];
  for (const entry of input) {
    if (
      entry &&
      typeof entry === "object" &&
      typeof (entry as Record<string, unknown>).lineItemId === "string" &&
      typeof (entry as Record<string, unknown>).selected === "boolean"
    ) {
      out.push(entry as SelectedOption);
    }
  }
  return out;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as SignRequestBody;
  const token = typeof body.token === "string" ? body.token : "";

  if (!verifyProposalToken(id, token)) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 401 });
  }

  const signerName = typeof body.signerName === "string" ? body.signerName.trim() : "";
  const consent = body.consent === true;

  if (!consent) {
    return NextResponse.json({ error: "Consent is required to sign" }, { status: 400 });
  }
  if (!signerName) {
    return NextResponse.json({ error: "Signer name is required" }, { status: 400 });
  }

  const signerEmail =
    typeof body.signerEmail === "string" && body.signerEmail.trim() ? body.signerEmail.trim() : null;
  const signatureTyped =
    typeof body.signatureTyped === "string" && body.signatureTyped.trim()
      ? body.signatureTyped.trim()
      : signerName;
  const selectedOptions = parseSelectedOptions(body.selectedOptions);

  const sb = getPipelineClient();
  const workspace_id = await getDefaultPipelineWorkspaceId();

  const { data: proposal } = await sb
    .from("crm_proposals")
    .select("id, status, requires_dual_sign, deal_id, title")
    .eq("workspace_id", workspace_id)
    .eq("id", id)
    .maybeSingle();

  if (!proposal) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 401 });
  }

  if (proposal.status === "signed" || proposal.status === "void") {
    return NextResponse.json({ error: `This proposal is already ${proposal.status}` }, { status: 409 });
  }
  if (proposal.status !== "sent" && proposal.status !== "viewed") {
    return NextResponse.json({ error: "This proposal is not open for signature" }, { status: 409 });
  }

  // Apply the client's option choices to the persisted line items. Only
  // is_selected changes here -- amounts, kinds, and cadences are never
  // taken from the request body.
  for (const opt of selectedOptions) {
    await sb
      .from("crm_proposal_line_items")
      .update({ is_selected: opt.selected })
      .eq("workspace_id", workspace_id)
      .eq("proposal_id", id)
      .eq("id", opt.lineItemId);
  }

  const { data: lineItemsData, error: lineItemsError } = await sb
    .from("crm_proposal_line_items")
    .select("*")
    .eq("workspace_id", workspace_id)
    .eq("proposal_id", id);
  if (lineItemsError) return NextResponse.json({ error: lineItemsError.message }, { status: 500 });

  // Totals are ALWAYS recomputed here from the persisted line items just
  // read above -- never from anything the client sent.
  const totals = computeTotals((lineItemsData ?? []) as CrmProposalLineItem[]);

  const ip = getClientIp(req);
  const userAgent = req.headers.get("user-agent");
  const signedAt = new Date().toISOString();

  // Conditional on the row still being sent/viewed at update time -- this is
  // what makes the sign atomic against a concurrent double-sign (TOCTOU): if
  // another request already flipped the status between our read above and
  // this write, this update matches 0 rows and we return 409 below instead of
  // silently overwriting an already-signed proposal.
  const { data: updatedRows, error: updateError } = await sb
    .from("crm_proposals")
    .update({
      status: "signed",
      signed_at: signedAt,
      signer_name: signerName,
      signer_email: signerEmail,
      signer_ip: ip,
      signature_typed: signatureTyped,
      signer_consent: true,
      subtotal_cents: totals.oneTimeCents,
      recurring_monthly_cents: totals.recurringMonthlyCents,
      deposit_cents: totals.depositCents,
    })
    .eq("workspace_id", workspace_id)
    .eq("id", id)
    .in("status", ["sent", "viewed"])
    .select("*");

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  const updated = updatedRows?.[0] ?? null;
  if (!updated) {
    return NextResponse.json({ error: "Already signed" }, { status: 409 });
  }

  await sb.from("crm_proposal_events").insert({
    workspace_id,
    proposal_id: id,
    type: "signed",
    actor: signerName,
    ip,
    user_agent: userAgent,
    meta: { signerEmail, selectedOptions, totals, requiresDualSign: proposal.requires_dual_sign },
  });

  // Surface the signature on the deal timeline and nudge the deal forward,
  // but only when this proposal is attached to a deal.
  const dealId = proposal.deal_id as string | null;
  if (dealId) {
    await sb.from("crm_activities").insert({
      workspace_id,
      deal_id: dealId,
      type: "note",
      body: `Proposal signed by ${signerName}: "${proposal.title}" (${formatCents(totals.oneTimeCents)})`,
      occurred_at: signedAt,
    });

    const { data: deal } = await sb
      .from("crm_deals")
      .select("id, stage")
      .eq("workspace_id", workspace_id)
      .eq("id", dealId)
      .maybeSingle();

    if (deal && PRE_BUILD_STAGES.has(deal.stage as string)) {
      await sb
        .from("crm_deals")
        .update({ stage: "build" })
        .eq("workspace_id", workspace_id)
        .eq("id", dealId);
    }
  }

  return NextResponse.json({ data: updated });
}
