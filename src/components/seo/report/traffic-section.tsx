// src/components/seo/report/traffic-section.tsx
import type { ReportData } from "@/lib/seo/report-data";
import { Section } from "./section";
import { MetricCard } from "./metric-card";

function fmtNum(n: number): string {
  return n.toLocaleString();
}

const SOURCE_LABELS = [
  { key: "search" as const, label: "Search" },
  { key: "direct" as const, label: "Direct" },
  { key: "referral" as const, label: "Referral" },
  { key: "social" as const, label: "Social" },
  { key: "other" as const, label: "Other" },
];

export function TrafficSection({ data }: { data: ReportData }) {
  if (!data.traffic) return null;
  const t = data.traffic;
  return (
    <Section title="Traffic">
      <div className="col-span-12 md:col-span-6">
        <MetricCard
          label="Sessions"
          size="hero"
          value={fmtNum(t.sessions.current)}
          delta={t.sessions.delta}
        />
      </div>
      <div className="col-span-12 md:col-span-6 grid grid-cols-3 gap-3">
        <MetricCard
          label="Organic Sessions"
          value={fmtNum(t.organic_sessions.current)}
          delta={t.organic_sessions.delta}
        />
        <MetricCard
          label="Users"
          value={fmtNum(t.users.current)}
          delta={t.users.delta}
        />
        <MetricCard
          label="Pages / Session"
          value={t.pages_per_session.current.toFixed(2)}
          delta={t.pages_per_session.delta}
        />
      </div>
      <div className="col-span-12 report-card p-6">
        <div className="report-label mb-4">Traffic Sources</div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {SOURCE_LABELS.map((s) => (
            <div key={s.key}>
              <div className="text-muted-foreground text-xs">{s.label}</div>
              <div className="text-2xl font-semibold text-foreground font-data tabular-nums mt-1">
                {t.sources[s.key]}%
              </div>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}
