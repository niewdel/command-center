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
    <svg width={w} height={h} className="text-primary opacity-60">
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        points={points}
      />
    </svg>
  );
}

export function HealthSection({ data }: { data: ReportData }) {
  const h = data.health;
  return (
    <Section title="SEO Health">
      <div className="col-span-12 md:col-span-7 bg-card border border-border rounded-lg p-6">
        <div className="text-muted-foreground text-xs uppercase font-semibold mb-3">
          Overall Score
        </div>
        <div className="text-7xl font-semibold text-primary font-data">
          {fmt(h.overall_score)}
        </div>
        <div className="mt-3 text-sm text-muted-foreground">
          {h.overall_delta != null
            ? `${h.overall_delta > 0 ? "+" : ""}${h.overall_delta} vs start of period`
            : "No prior data in window"}
        </div>
      </div>
      <div className="col-span-12 md:col-span-5 bg-card border border-border rounded-lg p-6">
        <div className="text-muted-foreground text-xs uppercase font-semibold mb-3">
          Open Issues
        </div>
        <div className="text-5xl font-semibold text-primary font-data">
          {h.open_issues.total}
        </div>
        <div className="mt-4 grid grid-cols-4 gap-2 text-xs">
          <div>
            <div className="text-destructive font-semibold tabular-nums">
              {h.open_issues.critical}
            </div>
            <div className="text-muted-foreground uppercase mt-1">Critical</div>
          </div>
          <div>
            <div className="text-amber-400 font-semibold tabular-nums">
              {h.open_issues.high}
            </div>
            <div className="text-muted-foreground uppercase mt-1">High</div>
          </div>
          <div>
            <div className="text-foreground font-semibold tabular-nums">
              {h.open_issues.medium}
            </div>
            <div className="text-muted-foreground uppercase mt-1">Medium</div>
          </div>
          <div>
            <div className="text-muted-foreground font-semibold tabular-nums">
              {h.open_issues.low}
            </div>
            <div className="text-muted-foreground uppercase mt-1">Low</div>
          </div>
        </div>
      </div>

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
              className="col-span-6 md:col-span-3 bg-card border border-border rounded-lg p-6"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="text-muted-foreground text-xs uppercase font-semibold">
                  {labelMap[key]}
                </div>
                <Spark values={card.history} />
              </div>
              <MetricCardInline
                value={card.current}
                delta={card.delta}
              />
            </div>
          );
        }
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
      <div className="text-3xl font-semibold text-primary font-data">
        {value == null ? "—" : value}
      </div>
      <div className="mt-2 text-xs">
        {delta == null ? (
          <span className="text-muted-foreground">No prior</span>
        ) : delta === 0 ? (
          <span className="text-muted-foreground">No change</span>
        ) : delta > 0 ? (
          <span className="text-emerald-400 tabular-nums font-data">
            ↑ {delta}
          </span>
        ) : (
          <span className="text-destructive tabular-nums font-data">
            ↓ {Math.abs(delta)}
          </span>
        )}
      </div>
    </>
  );
}
