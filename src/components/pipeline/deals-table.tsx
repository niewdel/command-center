"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUp, ArrowDown, ArrowUpDown, Clock3 } from "lucide-react";
import { STAGE_LABEL, STAGE_COLOR, type DealWithLinks } from "@/types/pipeline";
import { dealProbability, weightedValue } from "@/lib/pipeline/forecast";
import { isDealStale } from "@/lib/pipeline/stale";

function formatCurrency(cents: number | null): string {
  if (cents == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  // close_date_est is a date-only string (YYYY-MM-DD); next_action_at is a timestamp.
  const d = iso.length <= 10 ? new Date(iso + "T00:00:00") : new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

type SortKey = "title" | "company" | "stage" | "value" | "weighted" | "probability" | "next_action" | "owner" | "close_date";
type SortDir = "asc" | "desc";

const COLUMNS: { key: SortKey; label: string; align?: "right" }[] = [
  { key: "title", label: "Deal" },
  { key: "company", label: "Company" },
  { key: "stage", label: "Stage" },
  { key: "value", label: "Value", align: "right" },
  { key: "weighted", label: "Weighted", align: "right" },
  { key: "probability", label: "Probability", align: "right" },
  { key: "next_action", label: "Next action" },
  { key: "owner", label: "Owner" },
  { key: "close_date", label: "Close date" },
];

function sortValue(deal: DealWithLinks, key: SortKey): string | number {
  switch (key) {
    case "title":
      return deal.title.toLowerCase();
    case "company":
      return deal.company?.name.toLowerCase() ?? "";
    case "stage":
      return deal.stage;
    case "value":
      return deal.value_cents ?? -1;
    case "weighted":
      return weightedValue(deal);
    case "probability":
      return dealProbability(deal);
    case "next_action":
      return deal.next_action_at ? new Date(deal.next_action_at).getTime() : -1;
    case "owner":
      return deal.owner?.toLowerCase() ?? "";
    case "close_date":
      return deal.close_date_est ? new Date(deal.close_date_est).getTime() : -1;
  }
}

export function DealsTable({ deals }: { deals: DealWithLinks[] }) {
  const router = useRouter();
  const [sortKey, setSortKey] = useState<SortKey>("next_action");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const sorted = useMemo(() => {
    const copy = [...deals];
    copy.sort((a, b) => {
      const av = sortValue(a, sortKey);
      const bv = sortValue(b, sortKey);
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return copy;
  }, [deals, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  if (deals.length === 0) {
    return (
      <div className="rounded-lg border border-border p-8 text-center text-[11px] font-mono text-muted-foreground">
        No deals match the current filters.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-border">
            {COLUMNS.map((col) => (
              <th
                key={col.key}
                className={`px-3 py-2 text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap ${
                  col.align === "right" ? "text-right" : "text-left"
                }`}
              >
                <button
                  type="button"
                  onClick={() => handleSort(col.key)}
                  className={`inline-flex items-center gap-1 transition-colors hover:text-foreground ${
                    col.align === "right" ? "flex-row-reverse" : ""
                  }`}
                >
                  {col.label}
                  {sortKey === col.key ? (
                    sortDir === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />
                  ) : (
                    <ArrowUpDown size={11} className="opacity-30" />
                  )}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((deal) => {
            const stale = isDealStale(deal);
            return (
              <tr
                key={deal.id}
                onClick={() => router.push(`/pipeline/deals/${deal.id}`)}
                className="border-b border-border last:border-0 cursor-pointer transition-colors hover:bg-[var(--paper-sunken)]"
              >
                <td className="px-3 py-2.5 max-w-[220px]">
                  <Link
                    href={`/pipeline/deals/${deal.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="font-semibold text-foreground truncate block hover:underline"
                  >
                    {deal.title}
                  </Link>
                </td>
                <td className="px-3 py-2.5 text-muted-foreground truncate max-w-[160px]">
                  {deal.company?.name ?? "—"}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <span
                    className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider"
                    style={{ color: STAGE_COLOR[deal.stage] }}
                  >
                    <span className="size-1.5 rounded-full" style={{ backgroundColor: STAGE_COLOR[deal.stage] }} />
                    {STAGE_LABEL[deal.stage]}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums text-foreground whitespace-nowrap">
                  {formatCurrency(deal.value_cents)}
                </td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums text-muted-foreground whitespace-nowrap">
                  {formatCurrency(weightedValue(deal))}
                </td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums text-muted-foreground whitespace-nowrap">
                  {dealProbability(deal)}%
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  {stale ? (
                    <span
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider font-mono"
                      style={{ backgroundColor: "rgba(239,68,68,0.12)", color: "#EF4444" }}
                      title="No upcoming next action"
                    >
                      <Clock3 size={9} /> Stale
                    </span>
                  ) : (
                    <span className="text-[11px] font-mono text-muted-foreground">
                      {formatDate(deal.next_action_at)}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">{deal.owner ?? "—"}</td>
                <td className="px-3 py-2.5 font-mono tabular-nums text-muted-foreground whitespace-nowrap">
                  {formatDate(deal.close_date_est)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
