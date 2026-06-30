// src/components/seo/report/issues-wins-section.tsx
import type { ReportData } from "@/lib/seo/report-data";
import { Section } from "./section";

const SEVERITY_STYLES = {
  critical:
    "bg-muted text-[var(--neg)] border-[var(--neg)]/40 tracking-wider",
  high:
    "bg-muted text-[var(--warn)] border-[var(--warn)]/40 tracking-wider",
  medium:
    "bg-muted text-foreground border-border tracking-wider",
  low:
    "bg-muted text-muted-foreground border-border tracking-wider",
} as const;

export function IssuesWinsSection({ data }: { data: ReportData }) {
  const hasOpen = data.issues.open_top.length > 0;
  const hasResolved = data.issues.resolved.length > 0;
  if (!hasOpen && !hasResolved) return null;

  return (
    <Section title="05 · Issues & Wins">
      {hasOpen && (
        <div className="col-span-12 md:col-span-6 report-card p-6">
          <div className="report-label mb-3">What Needs Attention</div>
          <ul className="space-y-3">
            {data.issues.open_top.map((i, idx) => (
              <li key={`${i.title}-${idx}`} className="flex items-start gap-3">
                <span
                  className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded border shrink-0 ${SEVERITY_STYLES[i.severity]}`}
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
        </div>
      )}
      {hasResolved && (
        <div
          className={`col-span-12 ${hasOpen ? "md:col-span-6" : ""} report-card p-6`}
        >
          <div className="report-label mb-3">Resolved This Period</div>
          <ul className="space-y-2">
            {data.issues.resolved.map((r, idx) => (
              <li key={`${r.title}-${idx}`} className="flex items-start gap-2">
                <span className="text-[var(--pos)] shrink-0 font-bold">✓</span>
                <div className="text-sm">{r.title}</div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Section>
  );
}
