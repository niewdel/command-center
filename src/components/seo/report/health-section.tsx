// src/components/seo/report/health-section.tsx
import type { ReportData } from "@/lib/seo/report-data";
import { Section } from "./section";

function fmt(n: number | null): string {
  return n == null ? "—" : n.toString();
}

interface SparkProps {
  values: number[];
}
function Spark({ values }: SparkProps) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 80;
  const h = 24;
  const stepX = w / (values.length - 1);
  const points = values
    .map((v, i) => `${i * stepX},${h - ((v - min) / range) * h}`)
    .join(" ");
  return (
    <svg width={w} height={h} className="text-primary opacity-70">
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        points={points}
      />
    </svg>
  );
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
  // Match the email: only surface positive deltas on the hero. Negative
  // deltas exist in the data but aren't headline-worthy.
  const showDelta = h.overall_delta != null && h.overall_delta > 0;

  return (
    <Section title="Site Health">
      {/* Overall score — navy hero, mirroring the email's score block */}
      <div className="col-span-12 md:col-span-7 rounded-[14px] bg-[var(--rust-deep)] p-7">
        <div
          className="report-eyebrow mb-4"
          style={{ color: "#9DBEE8" }}
        >
          Overall Score
        </div>
        <div className="flex items-baseline gap-4 flex-wrap">
          <div className="text-7xl font-bold text-white font-data tracking-tight">
            {fmt(h.overall_score)}
            <span className="text-[#9DBEE8] text-3xl font-medium ml-2 opacity-80">
              /100
            </span>
          </div>
          <div className="space-y-1">
            <div className="text-sm font-semibold uppercase tracking-[0.12em] text-white">
              {label}
            </div>
            {showDelta && (
              <div className="text-sm text-[#C7E0C9]">
                ↑ {h.overall_delta} since the start of this period.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="col-span-12 md:col-span-5 report-card p-6">
        <div className="report-label mb-3">Open Issues</div>
        <div className="text-5xl font-bold text-foreground font-data tracking-tight">
          {h.open_issues.total}
        </div>
        <div className="mt-4 grid grid-cols-4 gap-2 text-xs">
          <div>
            <div className="text-[var(--neg)] font-semibold tabular-nums font-data">
              {h.open_issues.critical}
            </div>
            <div className="text-muted-foreground uppercase mt-1 tracking-wider">Critical</div>
          </div>
          <div>
            <div className="text-[var(--warn)] font-semibold tabular-nums font-data">
              {h.open_issues.high}
            </div>
            <div className="text-muted-foreground uppercase mt-1 tracking-wider">High</div>
          </div>
          <div>
            <div className="text-foreground font-semibold tabular-nums font-data">
              {h.open_issues.medium}
            </div>
            <div className="text-muted-foreground uppercase mt-1 tracking-wider">Medium</div>
          </div>
          <div>
            <div className="text-muted-foreground font-semibold tabular-nums font-data">
              {h.open_issues.low}
            </div>
            <div className="text-muted-foreground uppercase mt-1 tracking-wider">Low</div>
          </div>
        </div>
      </div>

      {/* Bottom row: four score-component cards with sparklines */}
      {(["technical", "onpage", "lighthouse_mobile", "lighthouse_desktop"] as const).map(
        (key) => {
          const labelMap = {
            technical: "Technical",
            onpage: "On-Page",
            lighthouse_mobile: "Lighthouse Mobile",
            lighthouse_desktop: "Lighthouse Desktop",
          };
          const card = h[key];
          return (
            <div
              key={key}
              className="col-span-6 md:col-span-3 report-card p-6"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="report-label">{labelMap[key]}</div>
                <Spark values={card.history} />
              </div>
              <MetricCardInline value={card.current} delta={card.delta} />
            </div>
          );
        },
      )}
    </Section>
  );
}

function MetricCardInline({
  value,
  delta,
}: {
  value: number | null;
  delta: number | null;
}) {
  return (
    <>
      <div className="text-3xl font-bold text-foreground font-data tracking-tight">
        {value == null ? "—" : value}
      </div>
      <div className="mt-2 text-xs">
        {delta == null ? (
          <span className="text-muted-foreground">No prior</span>
        ) : delta === 0 ? (
          <span className="text-muted-foreground">No change</span>
        ) : delta > 0 ? (
          <span className="text-[var(--pos)] tabular-nums font-data">
            ↑ {delta}
          </span>
        ) : (
          // Negative shown as muted to match the email's restrained handling
          <span className="text-muted-foreground tabular-nums font-data">
            ↓ {Math.abs(delta)}
          </span>
        )}
      </div>
    </>
  );
}
