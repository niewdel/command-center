// src/components/seo/report/issues-wins-section.tsx
import type { ReportData } from "@/lib/seo/report-data";
import { Section } from "./section";

const SEVERITY_STYLES = {
  critical: "bg-destructive/20 text-destructive border-destructive/40",
  high: "bg-amber-500/20 text-amber-400 border-amber-500/40",
  medium: "bg-foreground/10 text-foreground border-border",
  low: "bg-muted text-muted-foreground border-border",
} as const;

export function IssuesWinsSection({ data }: { data: ReportData }) {
  return (
    <Section title="Issues & Wins">
      <div className="col-span-12 md:col-span-6 bg-card border border-border rounded-lg p-6">
        <div className="text-muted-foreground text-xs uppercase font-semibold mb-3">
          What Needs Attention
        </div>
        {data.issues.open_top.length === 0 ? (
          <div className="text-muted-foreground text-sm">No critical or high issues open.</div>
        ) : (
          <ul className="space-y-3">
            {data.issues.open_top.map((i, idx) => (
              <li key={`${i.title}-${idx}`} className="flex items-start gap-3">
                <span
                  className={`text-xs uppercase font-semibold px-2 py-0.5 rounded border shrink-0 ${SEVERITY_STYLES[i.severity]}`}
                >
                  {i.severity}
                </span>
                <div className="min-w-0">
                  <div className="text-sm">{i.title}</div>
                  {i.page_url && (
                    <div className="text-xs text-muted-foreground truncate">
                      {i.page_url}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="col-span-12 md:col-span-6 bg-card border border-border rounded-lg p-6">
        <div className="text-muted-foreground text-xs uppercase font-semibold mb-3">
          Resolved This Period
        </div>
        {data.issues.resolved.length === 0 ? (
          <div className="text-muted-foreground text-sm">No fixes recorded this period.</div>
        ) : (
          <ul className="space-y-2">
            {data.issues.resolved.map((r, idx) => (
              <li key={`${r.title}-${idx}`} className="flex items-start gap-2">
                <span className="text-emerald-400 shrink-0">✓</span>
                <div className="text-sm">{r.title}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Section>
  );
}
