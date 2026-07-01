import type { CrmProposalLineItem, ProposalStatus } from "@/types/proposals";
import { resolveSelectedItems } from "./pricing";

/**
 * MRR / ARR aggregation from signed proposals (Task R1). Pure module — no
 * Supabase, no React. Mirrors the style of src/lib/pipeline/dashboard.ts:
 * functions take plain rows + `now`, return numbers/buckets, UTC bucketing.
 *
 * Signed proposals with `recurring` line items ARE recurring revenue — this
 * is the pre-Stripe MRR source of truth.
 */

/** Minimal typed shape the API route hands in: a proposal + its resolved company + raw line items. */
export type ProposalForMrr = {
  id: string;
  status: ProposalStatus;
  signed_at: string | null;
  crm_company_id: string | null;
  company: { id: string; name: string } | null;
  lineItems: CrmProposalLineItem[];
};

export type ActiveRecurringItem = CrmProposalLineItem & {
  proposalId: string;
  companyId: string | null;
  companyName: string | null;
};

/**
 * Recurring, selected line items from proposals whose status is `signed`.
 * Only `signed` proposals count as active revenue — draft/sent/viewed/
 * declined/void contribute nothing.
 */
export function activeRecurringItems(proposals: ProposalForMrr[]): ActiveRecurringItem[] {
  const result: ActiveRecurringItem[] = [];

  for (const proposal of proposals) {
    if (proposal.status !== "signed") continue;

    const resolved = resolveSelectedItems(proposal.lineItems);
    for (const item of resolved) {
      if (item.kind !== "recurring") continue;
      result.push({
        ...item,
        proposalId: proposal.id,
        companyId: proposal.crm_company_id,
        companyName: proposal.company?.name ?? null,
      });
    }
  }

  return result;
}

export type MrrSummary = {
  mrrCents: number;
  arrCents: number;
  activeContracts: number;
  evergreenCents: number;
  finiteCents: number;
};

/**
 * MRR = sum of active recurring monthly amounts. ARR = MRR x 12.
 * activeContracts = count of distinct signed proposals contributing at
 * least one active recurring item. evergreen/finite split by whether
 * `recurring_months` is null (evergreen) or set (finite term).
 */
export function computeMrr(proposals: ProposalForMrr[]): MrrSummary {
  const items = activeRecurringItems(proposals);

  let mrrCents = 0;
  let evergreenCents = 0;
  let finiteCents = 0;
  const contractIds = new Set<string>();

  for (const item of items) {
    mrrCents += item.amount_cents;
    if (item.recurring_months === null) {
      evergreenCents += item.amount_cents;
    } else {
      finiteCents += item.amount_cents;
    }
    contractIds.add(item.proposalId);
  }

  return {
    mrrCents,
    arrCents: mrrCents * 12,
    activeContracts: contractIds.size,
    evergreenCents,
    finiteCents,
  };
}

export type CompanyMrr = { companyId: string; companyName: string; mrrCents: number };

/** MRR grouped by company, sorted descending. Companies with no active recurring revenue are omitted. */
export function mrrByCompany(proposals: ProposalForMrr[]): CompanyMrr[] {
  const items = activeRecurringItems(proposals);
  const byCompany = new Map<string, CompanyMrr>();

  for (const item of items) {
    if (!item.companyId) continue;
    const existing = byCompany.get(item.companyId);
    if (existing) {
      existing.mrrCents += item.amount_cents;
    } else {
      byCompany.set(item.companyId, {
        companyId: item.companyId,
        companyName: item.companyName ?? "Unknown company",
        mrrCents: item.amount_cents,
      });
    }
  }

  return [...byCompany.values()].sort((a, b) => b.mrrCents - a.mrrCents);
}

/** MRR contributed by proposals signed in the current calendar month (UTC). */
export function newMrrThisMonth(proposals: ProposalForMrr[], now: Date = new Date()): number {
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  const signedThisMonth = new Set(
    proposals
      .filter((p) => {
        if (!p.signed_at) return false;
        const t = new Date(p.signed_at).getTime();
        return t >= monthStart.getTime() && t < nextMonthStart.getTime();
      })
      .map((p) => p.id)
  );

  return activeRecurringItems(proposals)
    .filter((item) => signedThisMonth.has(item.proposalId))
    .reduce((sum, item) => sum + item.amount_cents, 0);
}
