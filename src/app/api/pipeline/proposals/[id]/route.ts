import { NextRequest, NextResponse } from "next/server";
import { getPipelineClient, getDefaultPipelineWorkspaceId } from "@/lib/pipeline/db";
import {
  PROPOSAL_STATUSES,
  PROPOSAL_THEMES,
  PROPOSAL_TYPES,
  type CrmProposalLineItem,
} from "@/types/proposals";
import { computeTotals, formatCents } from "@/lib/proposals/pricing";

export const dynamic = "force-dynamic";

const PROPOSAL_SELECT = `*,
  company:crm_companies(id, name, domain, industry),
  contact:crm_contacts!crm_proposals_primary_contact_id_fkey(id, full_name, title, email, phone)`;

const PATCHABLE_FIELDS = [
  "title",
  "deal_id",
  "crm_company_id",
  "primary_contact_id",
  "theme",
  "content",
  "proposal_date",
  "validity_days",
  "prepared_by",
] as const;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = getPipelineClient();
  const workspace_id = await getDefaultPipelineWorkspaceId();

  const { data, error } = await sb
    .from("crm_proposals")
    .select(PROPOSAL_SELECT)
    .eq("workspace_id", workspace_id)
    .eq("id", id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: lineItems, error: lineItemsError } = await sb
    .from("crm_proposal_line_items")
    .select("*")
    .eq("workspace_id", workspace_id)
    .eq("proposal_id", id)
    .order("position", { ascending: true });
  if (lineItemsError) return NextResponse.json({ error: lineItemsError.message }, { status: 500 });

  const { data: events, error: eventsError } = await sb
    .from("crm_proposal_events")
    .select("*")
    .eq("workspace_id", workspace_id)
    .eq("proposal_id", id)
    .order("occurred_at", { ascending: true });
  if (eventsError) return NextResponse.json({ error: eventsError.message }, { status: 500 });

  return NextResponse.json({ data: { ...data, lineItems: lineItems ?? [], events: events ?? [] } });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = getPipelineClient();
  const workspace_id = await getDefaultPipelineWorkspaceId();
  const body = await req.json();

  const { data: existing } = await sb
    .from("crm_proposals")
    .select("id, status, deal_id, title")
    .eq("workspace_id", workspace_id)
    .eq("id", id)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const currentStatus = existing.status as string;
  const isTransitionToVoid = "status" in body && body.status === "void" && currentStatus !== "void";
  if ((currentStatus === "signed" || currentStatus === "void") && !isTransitionToVoid) {
    return NextResponse.json(
      { error: `Cannot edit a proposal that is ${currentStatus}` },
      { status: 400 }
    );
  }

  const patch: Record<string, unknown> = {};
  for (const k of PATCHABLE_FIELDS) {
    if (k in body) patch[k] = body[k];
  }

  if ("title" in patch && !String(patch.title).trim()) {
    return NextResponse.json({ error: "title cannot be empty" }, { status: 400 });
  }
  if ("title" in patch) patch.title = String(patch.title).trim();

  if ("type" in body) {
    if (!PROPOSAL_TYPES.includes(body.type)) {
      return NextResponse.json({ error: `Invalid type: ${body.type}` }, { status: 400 });
    }
    patch.type = body.type;
  }
  if ("theme" in body && !PROPOSAL_THEMES.includes(body.theme)) {
    return NextResponse.json({ error: `Invalid theme: ${body.theme}` }, { status: 400 });
  }
  let shouldLogSentEvent = false;
  if ("status" in body) {
    if (!PROPOSAL_STATUSES.includes(body.status)) {
      return NextResponse.json({ error: `Invalid status: ${body.status}` }, { status: 400 });
    }
    patch.status = body.status;
    if (body.status === "void") patch.declined_at = patch.declined_at ?? null;
    // Sending is idempotent: only stamp sent_at + log the event the first
    // time a proposal transitions into 'sent' (currentStatus is 'draft' at
    // that point since 'signed'/'void' are already rejected above).
    if (body.status === "sent" && currentStatus !== "sent") {
      patch.sent_at = new Date().toISOString();
      shouldLogSentEvent = true;
    }
  }

  // Recompute + snapshot totals from the proposal's current line items on
  // every successful patch, per the plan: never trust stale totals.
  const { data: lineItems, error: lineItemsError } = await sb
    .from("crm_proposal_line_items")
    .select("*")
    .eq("workspace_id", workspace_id)
    .eq("proposal_id", id);
  if (lineItemsError) return NextResponse.json({ error: lineItemsError.message }, { status: 500 });

  const totals = computeTotals((lineItems ?? []) as CrmProposalLineItem[]);
  patch.subtotal_cents = totals.oneTimeCents;
  patch.recurring_monthly_cents = totals.recurringMonthlyCents;
  patch.deposit_cents = totals.depositCents;

  const { data, error } = await sb
    .from("crm_proposals")
    .update(patch)
    .eq("workspace_id", workspace_id)
    .eq("id", id)
    .select(PROPOSAL_SELECT)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (shouldLogSentEvent) {
    await sb.from("crm_proposal_events").insert({
      workspace_id,
      proposal_id: id,
      type: "sent",
      meta: {},
    });

    // Surface the send on the deal timeline. crm_activities.type has no
    // 'proposal_sent' value, so this is logged as a plain 'note' with a
    // clear body (see the deal activities API CHECK constraint).
    const dealId = "deal_id" in patch ? (patch.deal_id as string | null) : existing.deal_id;
    if (dealId) {
      const title = "title" in patch ? String(patch.title) : (existing.title as string);
      await sb.from("crm_activities").insert({
        workspace_id,
        deal_id: dealId,
        type: "note",
        body: `Proposal sent: "${title}" (${formatCents(totals.oneTimeCents)})`,
        occurred_at: new Date().toISOString(),
      });
    }
  }

  return NextResponse.json({ data });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = getPipelineClient();
  const workspace_id = await getDefaultPipelineWorkspaceId();

  const { data: existing } = await sb
    .from("crm_proposals")
    .select("id")
    .eq("workspace_id", workspace_id)
    .eq("id", id)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { error } = await sb.from("crm_proposals").delete().eq("workspace_id", workspace_id).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
