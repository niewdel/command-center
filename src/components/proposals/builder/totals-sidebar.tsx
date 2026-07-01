"use client";

// Live totals sidebar (Task P4): recomputes from the current, in-progress
// line items via the P1 pricing engine on every render, so the number
// updates as soon as the user edits a row, before saving.

import { computeTotals, formatCents } from "@/lib/proposals/pricing";
import type { CrmProposalLineItem } from "@/types/proposals";

export function TotalsSidebar({ items }: { items: CrmProposalLineItem[] }) {
  const totals = computeTotals(items);

  const rows: { label: string; value: string }[] = [
    { label: "One-time subtotal", value: formatCents(totals.oneTimeCents) },
    { label: "Recurring / month", value: formatCents(totals.recurringMonthlyCents) },
    { label: "Handoff", value: formatCents(totals.handoffCents) },
    { label: "Deposit (50% of one-time)", value: formatCents(totals.depositCents) },
  ];

  return (
    <div className="rounded-lg border border-border p-4 space-y-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Live totals</p>
      <dl className="space-y-2">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-3">
            <dt className="text-xs text-muted-foreground">{row.label}</dt>
            <dd className="text-sm font-semibold tabular-nums">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
