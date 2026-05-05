"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { ReportRange } from "@/lib/seo/report-data";

const TABS: Array<{ key: ReportRange; label: string }> = [
  { key: "30d", label: "30d" },
  { key: "90d", label: "90d" },
  { key: "life", label: "Lifetime" },
];

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
    <div className="inline-flex items-center gap-1 rounded-lg bg-card border border-border p-1">
      {TABS.map((t) => {
        const isActive = t.key === active;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => go(t.key)}
            className={
              isActive
                ? "rounded px-3 py-1 text-sm bg-foreground text-background"
                : "rounded px-3 py-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            }
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
