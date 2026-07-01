// src/components/portal/TrafficPanel.tsx
//
// Client-facing traffic panel. Reuses MetricCard/Delta from the report
// primitives; layout mirrors the operator report's TrafficSection.

import type { ReportData } from "@/lib/seo/report-types";
import { MetricCard } from "@/components/seo/report/metric-card";

const SOURCE_LABELS = [
  { key: "search" as const, label: "Search" },
  { key: "direct" as const, label: "Direct" },
  { key: "referral" as const, label: "Referral" },
  { key: "social" as const, label: "Social" },
  { key: "other" as const, label: "Other" },
];

export function TrafficPanel({ data }: { data: ReportData }) {
  const t = data.traffic;

  return (
    <section>
      <div className="mb-5">
        <h2 className="report-eyebrow">Your Traffic</h2>
        <span className="report-rule mt-2" />
      </div>

      {t ? (
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-12 md:col-span-6">
            <MetricCard
              label="Visits"
              size="hero"
              value={t.sessions.current.toLocaleString()}
              delta={t.sessions.delta}
            />
          </div>
          <div className="col-span-12 md:col-span-6 grid grid-cols-3 gap-3">
            <MetricCard
              label="Organic Visits"
              value={t.organic_sessions.current.toLocaleString()}
              delta={t.organic_sessions.delta}
            />
            <MetricCard
              label="Users"
              value={t.users.current.toLocaleString()}
              delta={t.users.delta}
            />
            <MetricCard
              label="Pages / Visit"
              value={t.pages_per_session.current.toFixed(2)}
              delta={t.pages_per_session.delta}
            />
          </div>
          <div className="col-span-12 report-card p-6">
            <div className="report-label mb-4">Where Visitors Come From</div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {SOURCE_LABELS.map((s) => (
                <div key={s.key}>
                  <div className="text-muted-foreground text-xs">
                    {s.label}
                  </div>
                  <div className="text-2xl font-semibold text-foreground font-data tabular-nums mt-1">
                    {t.sources[s.key]}%
                  </div>
                  <div className="mt-2 h-1.5 w-full rounded-full bg-muted/40 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[var(--rust)]"
                      style={{ width: `${t.sources[s.key]}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="report-card p-6 border-dashed">
          <p className="text-base font-bold text-foreground tracking-tight mb-2">
            Traffic isn&apos;t connected yet.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-[60ch]">
            Once analytics is set up on your site, visits, organic traffic,
            and where people come from will show up here.
          </p>
        </div>
      )}
    </section>
  );
}
