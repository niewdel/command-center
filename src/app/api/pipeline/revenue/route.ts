import { NextResponse } from "next/server";
import { getUserScopedClient, resolveActiveWorkspace } from "@/lib/tenancy";
import { computeMrr, mrrByCompany, newMrrThisMonth, type ProposalForMrr } from "@/lib/proposals/mrr";
import type { CrmProposalLineItem, ProposalStatus } from "@/types/proposals";

export const dynamic = "force-dynamic";

type SignedProposalRow = {
  id: string;
  status: ProposalStatus;
  signed_at: string | null;
  crm_company_id: string | null;
  company: { id: string; name: string } | { id: string; name: string }[] | null;
};

export async function GET() {
  try {
    const ws = await resolveActiveWorkspace();
    if (!ws) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const sb = await getUserScopedClient();
    const workspace_id = ws.id;

    const { data: proposals, error: proposalsError } = await sb
      .from("crm_proposals")
      .select("id, status, signed_at, crm_company_id, company:crm_companies(id, name)")
      .eq("workspace_id", workspace_id)
      .eq("status", "signed");

    if (proposalsError) {
      return NextResponse.json({ error: proposalsError.message }, { status: 500 });
    }

    const rows = (proposals ?? []) as unknown as SignedProposalRow[];
    const proposalIds = rows.map((p) => p.id);

    let lineItemsByProposal = new Map<string, CrmProposalLineItem[]>();
    if (proposalIds.length > 0) {
      const { data: lineItems, error: lineItemsError } = await sb
        .from("crm_proposal_line_items")
        .select("*")
        .in("proposal_id", proposalIds);

      if (lineItemsError) {
        return NextResponse.json({ error: lineItemsError.message }, { status: 500 });
      }

      lineItemsByProposal = (lineItems ?? []).reduce((map, item) => {
        const list = map.get(item.proposal_id) ?? [];
        list.push(item as CrmProposalLineItem);
        map.set(item.proposal_id, list);
        return map;
      }, new Map<string, CrmProposalLineItem[]>());
    }

    const proposalsForMrr: ProposalForMrr[] = rows.map((p) => {
      const company = Array.isArray(p.company) ? (p.company[0] ?? null) : p.company;
      return {
        id: p.id,
        status: p.status,
        signed_at: p.signed_at,
        crm_company_id: p.crm_company_id,
        company,
        lineItems: lineItemsByProposal.get(p.id) ?? [],
      };
    });

    const summary = computeMrr(proposalsForMrr);
    const byCompany = mrrByCompany(proposalsForMrr);
    const newMrr = newMrrThisMonth(proposalsForMrr);

    return NextResponse.json({
      data: {
        ...summary,
        newMrrThisMonthCents: newMrr,
        byCompany,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
