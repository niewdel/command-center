import { NextRequest, NextResponse } from "next/server";
import { getPipelineClient, getDefaultPipelineWorkspaceId } from "@/lib/pipeline/db";
import { PROPOSAL_TYPES, type CrmProposalLineItem, type ProposalType } from "@/types/proposals";
import { presetFor } from "@/lib/proposals/presets";
import { computeTotals } from "@/lib/proposals/pricing";

export const dynamic = "force-dynamic";

const PROPOSAL_SELECT = `*,
  company:crm_companies(id, name, domain, industry),
  contact:crm_contacts!crm_proposals_primary_contact_id_fkey(id, full_name, title, email, phone)`;

export async function GET(req: NextRequest) {
  const sb = getPipelineClient();
  const workspace_id = await getDefaultPipelineWorkspaceId();
  const dealId = req.nextUrl.searchParams.get("deal_id");

  let query = sb
    .from("crm_proposals")
    .select(PROPOSAL_SELECT)
    .eq("workspace_id", workspace_id);
  if (dealId) query = query.eq("deal_id", dealId);
  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}

export async function POST(req: NextRequest) {
  const sb = getPipelineClient();
  const workspace_id = await getDefaultPipelineWorkspaceId();
  const body = await req.json();

  const type = body.type as ProposalType;
  if (!PROPOSAL_TYPES.includes(type)) {
    return NextResponse.json({ error: `Invalid type: ${body.type}` }, { status: 400 });
  }
  if (!body.title?.trim()) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  let crm_company_id: string | null = body.crm_company_id ?? null;
  let primary_contact_id: string | null = body.primary_contact_id ?? null;
  const deal_id: string | null = body.deal_id ?? null;

  if (deal_id) {
    const { data: deal } = await sb
      .from("crm_deals")
      .select("id, crm_company_id, primary_contact_id")
      .eq("workspace_id", workspace_id)
      .eq("id", deal_id)
      .maybeSingle();
    if (!deal) return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    crm_company_id = crm_company_id ?? (deal.crm_company_id as string | null);
    primary_contact_id = primary_contact_id ?? (deal.primary_contact_id as string | null);
  }

  const preset = presetFor(type);

  // Totals only depend on kind/option_group/is_optional/is_selected/amount_cents/
  // position, so we can snapshot them off the preset before the line items have
  // real ids. Placeholder fields below are never read by computeTotals.
  const previewItems: CrmProposalLineItem[] = preset.lineItems.map((item) => ({
    ...item,
    id: "",
    workspace_id,
    proposal_id: "",
    created_at: "",
  }));
  const totals = computeTotals(previewItems);

  const { data: proposal, error: proposalError } = await sb
    .from("crm_proposals")
    .insert({
      workspace_id,
      deal_id,
      crm_company_id,
      primary_contact_id,
      type,
      title: body.title.trim(),
      content: preset.blocks,
      requires_dual_sign: preset.requiresDualSign,
      subtotal_cents: totals.oneTimeCents,
      recurring_monthly_cents: totals.recurringMonthlyCents,
      deposit_cents: totals.depositCents,
    })
    .select(PROPOSAL_SELECT)
    .single();

  if (proposalError) return NextResponse.json({ error: proposalError.message }, { status: 500 });

  const { data: lineItems, error: lineItemsError } = await sb
    .from("crm_proposal_line_items")
    .insert(
      preset.lineItems.map((item) => ({
        ...item,
        workspace_id,
        proposal_id: proposal.id,
      }))
    )
    .select("*")
    .order("position", { ascending: true });

  if (lineItemsError) return NextResponse.json({ error: lineItemsError.message }, { status: 500 });

  await sb.from("crm_proposal_events").insert({
    workspace_id,
    proposal_id: proposal.id,
    type: "created",
    meta: {},
  });

  return NextResponse.json({ data: { ...proposal, lineItems: lineItems ?? [] } });
}
