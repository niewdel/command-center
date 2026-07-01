"use client";

// Client-facing range switcher for the Customer Portal. Deliberately
// narrower than the operator report's RangeTabs (30/90/Lifetime) — the
// portal only ever shows a rolling window (30/60/90), never "life", so
// clients always see a fresh, dated snapshot.

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { RANGE_LABEL } from "@/lib/seo/report-types";
import type { ReportRange } from "@/lib/seo/report-types";

export const PORTAL_RANGES: ReportRange[] = ["30d", "60d", "90d"];

export function RangeTabs({ active }: { active: ReportRange }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function go(range: ReportRange) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", range);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div
      role="tablist"
      aria-label="Reporting range"
      className="inline-flex items-center gap-1 rounded-full bg-card border border-border p-1"
    >
      {PORTAL_RANGES.map((range) => {
        const isActive = range === active;
        return (
          <button
            key={range}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => go(range)}
            className={
              isActive
                ? "rounded-full px-4 py-1.5 text-sm font-semibold bg-[var(--rust)] text-white transition-colors"
                : "rounded-full px-4 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            }
          >
            {RANGE_LABEL[range].replace("Last ", "")}
          </button>
        );
      })}
    </div>
  );
}
