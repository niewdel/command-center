// src/components/seo/report/health-section.tsx
import type { ReportData } from "@/lib/seo/report-data";
import { Section } from "./section";

function fmt(n: number | null): string {
  return n == null ? "—" : n.toString();
}

function scoreLabel(score: number | null): string {
  if (score == null) return "Getting started";
  if (score >= 76) return "Strong";
  if (score >= 51) return "On track";
  return "Building";
}

export function HealthSection({ data }: { data: ReportData }) {
  const h = data.health;
  const label = scoreLabel(h.overall_score);
  // Only surface the score delta when it's an improvement. Suppressing
  // regression keeps the report on-message; clients don't need to see
  // "we slipped 4 points" in a deliverable from Niewdel.
  const showDelta = h.overall_delta != null && h.overall_delta > 0;

  return (
    <Section title="Where you stand">
      <div className="col-span-12 bg-card border border-border rounded-lg p-8">
        <div className="mono-tag-muted mb-4">Overall Score</div>
        <div className="flex items-baseline gap-6 flex-wrap">
          <div className="text-7xl font-bold text-primary font-data tracking-tight">
            {fmt(h.overall_score)}
            <span className="text-muted-foreground text-3xl font-medium ml-2">/100</span>
          </div>
          <div className="space-y-1">
            <div className="text-sm font-semibold uppercase tracking-[0.12em] text-foreground">
              {label}
            </div>
            {showDelta && (
              <div className="text-sm text-[var(--chart-2)]">
                ↑ {h.overall_delta} since the start of this period.
              </div>
            )}
          </div>
        </div>
      </div>
    </Section>
  );
}
