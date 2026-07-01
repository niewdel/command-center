import type { CrmProposalLineItem } from "@/types/proposals";

/**
 * Pricing engine for the proposal builder (Task P1).
 *
 * Pure module — no Supabase, no React. Money is always integer cents.
 */

/**
 * Resolve which line items actually count toward totals/display:
 * - Items with no `option_group` and not optional are always kept.
 * - Optional (non-grouped) items are kept only when `is_selected`.
 * - For each `option_group`, only one item is kept: the selected one, or
 *   (if none is selected) the first by `position`, which is then treated
 *   as selected.
 */
export function resolveSelectedItems(items: CrmProposalLineItem[]): CrmProposalLineItem[] {
  const grouped = new Map<string, CrmProposalLineItem[]>();
  const ungrouped: CrmProposalLineItem[] = [];

  for (const item of items) {
    if (item.option_group) {
      const bucket = grouped.get(item.option_group) ?? [];
      bucket.push(item);
      grouped.set(item.option_group, bucket);
    } else {
      ungrouped.push(item);
    }
  }

  const resolved: CrmProposalLineItem[] = [];

  for (const item of ungrouped) {
    if (item.is_optional && !item.is_selected) continue;
    resolved.push(item);
  }

  for (const groupItems of grouped.values()) {
    const selected = groupItems.find((i) => i.is_selected);
    if (selected) {
      resolved.push(selected);
    } else {
      const byPosition = [...groupItems].sort((a, b) => a.position - b.position);
      const fallback = byPosition[0];
      if (fallback) resolved.push({ ...fallback, is_selected: true });
    }
  }

  return resolved;
}

export type ProposalTotals = {
  oneTimeCents: number;
  recurringMonthlyCents: number;
  handoffCents: number;
  depositCents: number;
};

/**
 * Sum resolved-selected line items by `kind`. `depositCents` is 50% of the
 * one-time subtotal, rounded to the nearest cent.
 */
export function computeTotals(items: CrmProposalLineItem[]): ProposalTotals {
  const resolved = resolveSelectedItems(items);

  let oneTimeCents = 0;
  let recurringMonthlyCents = 0;
  let handoffCents = 0;

  for (const item of resolved) {
    switch (item.kind) {
      case "one_time":
        oneTimeCents += item.amount_cents;
        break;
      case "recurring":
        recurringMonthlyCents += item.amount_cents;
        break;
      case "handoff":
        handoffCents += item.amount_cents;
        break;
    }
  }

  return {
    oneTimeCents,
    recurringMonthlyCents,
    handoffCents,
    depositCents: Math.round(oneTimeCents * 0.5),
  };
}

/** oneTime + handoff + recurringMonthly x months, over resolved-selected items. */
export function nMonthTotal(items: CrmProposalLineItem[], months: number): number {
  const { oneTimeCents, recurringMonthlyCents, handoffCents } = computeTotals(items);
  return oneTimeCents + handoffCents + recurringMonthlyCents * months;
}

/**
 * Format integer cents as USD for display: `$1,234` when the amount is a
 * whole dollar figure, `$1,234.56` otherwise. Handles zero and negatives.
 */
export function formatCents(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const dollars = abs / 100;
  const hasCents = abs % 100 !== 0;

  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: hasCents ? 2 : 0,
  }).format(dollars);

  return `${sign}${formatted}`;
}
