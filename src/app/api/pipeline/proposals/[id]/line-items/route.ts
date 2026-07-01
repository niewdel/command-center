import { NextRequest, NextResponse } from "next/server";
import { getUserScopedClient, resolveActiveWorkspace } from "@/lib/tenancy";
import { LINE_ITEM_CADENCES, LINE_ITEM_KINDS, type CrmProposalLineItem } from "@/types/proposals";
import { computeTotals } from "@/lib/proposals/pricing";

export const dynamic = "force-dynamic";

type LineItemInput = {
  kind: string;
  label: string;
  description?: string | null;
  badge?: string | null;
  amount_cents: number;
  cadence: string;
  recurring_months?: number | null;
  option_group?: string | null;
  is_optional?: boolean;
  is_selected?: boolean;
  position?: number;
};

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ws = await resolveActiveWorkspace();
  if (!ws) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sb = await getUserScopedClient();
  const workspace_id = ws.id;
  const body = await req.json();

  const { data: proposal } = await sb
    .from("crm_proposals")
    .select("id, status")
    .eq("workspace_id", workspace_id)
    .eq("id", id)
    .maybeSingle();
  if (!proposal) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (proposal.status === "signed" || proposal.status === "void") {
    return NextResponse.json(
      { error: `Cannot edit line items on a proposal that is ${proposal.status}` },
      { status: 400 }
    );
  }

  if (!Array.isArray(body.lineItems)) {
    return NextResponse.json({ error: "lineItems must be an array" }, { status: 400 });
  }

  const items = body.lineItems as LineItemInput[];
  for (const item of items) {
    if (!LINE_ITEM_KINDS.includes(item.kind as (typeof LINE_ITEM_KINDS)[number])) {
      return NextResponse.json({ error: `Invalid kind: ${item.kind}` }, { status: 400 });
    }
    if (!LINE_ITEM_CADENCES.includes(item.cadence as (typeof LINE_ITEM_CADENCES)[number])) {
      return NextResponse.json({ error: `Invalid cadence: ${item.cadence}` }, { status: 400 });
    }
    if (!item.label?.trim()) {
      return NextResponse.json({ error: "Every line item needs a label" }, { status: 400 });
    }
  }

  const { error: deleteError } = await sb
    .from("crm_proposal_line_items")
    .delete()
    .eq("workspace_id", workspace_id)
    .eq("proposal_id", id);
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });

  let inserted: CrmProposalLineItem[] = [];
  if (items.length > 0) {
    const { data, error: insertError } = await sb
      .from("crm_proposal_line_items")
      .insert(
        items.map((item, index) => ({
          workspace_id,
          proposal_id: id,
          kind: item.kind,
          label: item.label.trim(),
          description: item.description ?? null,
          badge: item.badge ?? null,
          amount_cents: item.amount_cents ?? 0,
          cadence: item.cadence,
          recurring_months: item.recurring_months ?? null,
          option_group: item.option_group ?? null,
          is_optional: item.is_optional ?? false,
          is_selected: item.is_selected ?? true,
          position: item.position ?? index,
        }))
      )
      .select("*")
      .order("position", { ascending: true });
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
    inserted = (data ?? []) as CrmProposalLineItem[];
  }

  const totals = computeTotals(inserted);
  const { data: updatedProposal, error: updateError } = await sb
    .from("crm_proposals")
    .update({
      subtotal_cents: totals.oneTimeCents,
      recurring_monthly_cents: totals.recurringMonthlyCents,
      deposit_cents: totals.depositCents,
    })
    .eq("workspace_id", workspace_id)
    .eq("id", id)
    .select("*")
    .single();
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({ data: { proposal: updatedProposal, lineItems: inserted } });
}
