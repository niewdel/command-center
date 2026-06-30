// src/components/seo/report/keywords-section.tsx
import type { ReportData } from "@/lib/seo/report-data";
import { Section } from "./section";
import { MetricCard } from "./metric-card";

export function KeywordsSection({ data }: { data: ReportData }) {
  if (!data.keywords) return null;
  const k = data.keywords;
  return (
    <Section title="Keyword Rankings">
      <div className="col-span-12 md:col-span-4 report-card p-6">
        <div className="report-label mb-3">Phrases Ranking</div>
        <div className="text-5xl font-bold text-foreground font-data tracking-tight">
          {k.ranking_count}
          <span className="text-muted-foreground text-3xl">/{k.tracked_count}</span>
        </div>
        <div className="text-muted-foreground text-xs mt-2">
          {k.tracked_count > 0
            ? `${Math.round((k.ranking_count / k.tracked_count) * 100)}% of phrases`
            : "—"}
        </div>
      </div>
      <div className="col-span-6 md:col-span-4">
        <MetricCard
          label="Average Search Rank"
          value={k.avg_rank == null ? "—" : k.avg_rank.toString()}
        />
      </div>
      <div className="col-span-6 md:col-span-4">
        <MetricCard
          label="Total Search Volume"
          value={k.total_search_volume.toLocaleString()}
        />
      </div>

      <div className="col-span-12 md:col-span-6 report-card p-6">
        <div className="report-label mb-3" style={{ color: "var(--pos)" }}>
          Climbers
        </div>
        {k.top_movers_up.length === 0 ? (
          <div className="text-muted-foreground text-sm">No climbers this period.</div>
        ) : (
          <ul className="space-y-2">
            {k.top_movers_up.map((m) => (
              <li key={m.keyword} className="flex justify-between items-baseline gap-3">
                <span className="text-sm truncate">{m.keyword}</span>
                <span className="tabular-nums font-data text-sm">
                  <span className="text-muted-foreground">{m.prior_rank ?? "—"}</span>
                  <span className="mx-2 text-muted-foreground">→</span>
                  <span className="text-foreground">{m.rank ?? "—"}</span>
                  <span className="ml-3 text-[var(--pos)]">↑ {Math.abs(m.delta as number)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="col-span-12 md:col-span-6 report-card p-6">
        <div className="report-label mb-3" style={{ color: "var(--neg)" }}>
          Slippage
        </div>
        {k.top_movers_down.length === 0 ? (
          <div className="text-muted-foreground text-sm">No slippage this period.</div>
        ) : (
          <ul className="space-y-2">
            {k.top_movers_down.map((m) => (
              <li key={m.keyword} className="flex justify-between items-baseline gap-3">
                <span className="text-sm truncate">{m.keyword}</span>
                <span className="tabular-nums font-data text-sm">
                  <span className="text-muted-foreground">{m.prior_rank ?? "—"}</span>
                  <span className="mx-2 text-muted-foreground">→</span>
                  <span className="text-foreground">{m.rank ?? "—"}</span>
                  <span className="ml-3 text-[var(--neg)]">↓ {m.delta}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Section>
  );
}
