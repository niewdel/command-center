// src/components/seo/report/issues-wins-section.tsx
//
// Editorial direction (v2): the "What Needs Attention" list was cut.
// Showing a list of unresolved issues every month reads as a permanent
// backlog to the client and undermines confidence. Only the "Resolved"
// list ships in client-facing reports.

import type { ReportData } from "@/lib/seo/report-data";
import { Section } from "./section";

export function IssuesWinsSection({ data }: { data: ReportData }) {
  // If nothing was resolved this period, hide the section entirely so the
  // client doesn't see an empty "wins" placeholder.
  if (data.issues.resolved.length === 0) return null;

  return (
    <Section title="Wins This Period">
      <div className="col-span-12 bg-card border border-border rounded-lg p-6">
        <div className="mono-tag-muted mb-3">Resolved</div>
        <ul className="space-y-2">
          {data.issues.resolved.map((r, idx) => (
            <li key={`${r.title}-${idx}`} className="flex items-start gap-2">
              <span className="text-[var(--chart-2)] shrink-0">✓</span>
              <div className="text-sm">{r.title}</div>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}
