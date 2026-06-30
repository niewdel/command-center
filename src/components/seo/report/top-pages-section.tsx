// src/components/seo/report/top-pages-section.tsx
import type { ReportData } from "@/lib/seo/report-data";
import { humanizePath } from "@/lib/seo/page-name";
import { Section } from "./section";

export function TopPagesSection({ data }: { data: ReportData }) {
  if (data.top_pages.length === 0) return null;
  return (
    <Section title="Top Pages">
      <div className="col-span-12 report-card p-6">
        <table className="w-full">
          <thead>
            <tr>
              <th className="report-label text-left pb-3">Page</th>
              <th className="report-label text-right pb-3">Sessions</th>
              <th className="report-label text-right pb-3 w-32">% of total</th>
            </tr>
          </thead>
          <tbody>
            {data.top_pages.map((p) => (
              <tr key={p.path} className="border-t border-border">
                <td className="py-3 text-sm truncate max-w-md" title={p.path}>
                  {humanizePath(p.path)}
                </td>
                <td className="py-3 text-right tabular-nums font-data text-foreground">
                  {p.sessions.toLocaleString()}
                </td>
                <td className="py-3 text-right tabular-nums font-data text-primary">
                  {p.pct_of_total}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}
