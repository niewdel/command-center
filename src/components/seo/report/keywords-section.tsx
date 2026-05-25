// src/components/seo/report/keywords-section.tsx
//
// Editorial direction (v2): "Top Movers Down" and "Average Search Rank"
// were cut. Both can read as bad news for the client and Niewdel's work.
// The section now shows phrases ranking, total search volume, and the
// climbers list only.

import type { ReportData } from "@/lib/seo/report-data";
import { Section } from "./section";
import { MetricCard } from "./metric-card";

export function KeywordsSection({ data }: { data: ReportData }) {
  if (!data.keywords) return null;
  const k = data.keywords;
  return (
    <Section title="Keyword Rankings">
      <div className="col-span-12 md:col-span-6 bg-card border border-border rounded-lg p-6">
        <div className="mono-tag-muted mb-3">Phrases Ranking</div>
        <div className="text-5xl font-semibold text-primary font-data">
          {k.ranking_count}
          <span className="text-muted-foreground text-3xl">/{k.tracked_count}</span>
        </div>
        <div className="text-muted-foreground text-xs mt-2">
          {k.tracked_count > 0
            ? `${Math.round((k.ranking_count / k.tracked_count) * 100)}% of phrases`
            : "—"}
        </div>
      </div>
      <div className="col-span-12 md:col-span-6">
        <MetricCard
          label="Total Search Volume"
          value={k.total_search_volume.toLocaleString()}
        />
      </div>
      {k.top_movers_up.length > 0 && (
        <div className="col-span-12 bg-card border border-border rounded-lg p-6">
          <div className="mono-tag-muted mb-3">Climbers This Period</div>
          <ul className="space-y-2">
            {k.top_movers_up.map((m) => (
              <li key={m.keyword} className="flex justify-between items-baseline gap-3">
                <span className="text-sm truncate">{m.keyword}</span>
                <span className="tabular-nums font-data text-sm">
                  <span className="text-muted-foreground">{m.prior_rank ?? "—"}</span>
                  <span className="mx-2 text-muted-foreground">→</span>
                  <span className="text-primary">{m.rank ?? "—"}</span>
                  <span className="ml-3 text-[var(--chart-2)]">↑ {Math.abs(m.delta as number)}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Section>
  );
}
