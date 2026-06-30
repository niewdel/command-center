// src/components/seo/report/top-pages-section.tsx
import type { ReportData } from "@/lib/seo/report-data";
import { Section } from "./section";

// Turn a URL path into a readable page name a client can scan, the way the
// homepage already reads as "Home". "/services/detail-packages" → "Detail
// Packages", "/contact" → "Contact".
function humanizePath(path: string): string {
  let p = (path || "").trim();
  p = p.replace(/^https?:\/\/[^/]+/i, ""); // drop domain if present
  p = p.split("?")[0].split("#")[0].replace(/\/+$/, ""); // drop query/hash/trailing slash
  if (p === "" || p === "/" || p.toLowerCase() === "home") return "Home";
  const seg = p.split("/").filter(Boolean).pop() ?? "";
  const cleaned = seg
    .replace(/\.(html?|php|aspx?)$/i, "")
    .replace(/[-_]+/g, " ")
    .trim();
  if (!cleaned) return "Home";
  return cleaned.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function TopPagesSection({ data }: { data: ReportData }) {
  if (data.top_pages.length === 0) return null;
  return (
    <Section title="Top Pages">
      <div className="col-span-12 bg-card border border-border rounded-lg p-6">
        <table className="w-full">
          <thead>
            <tr className="text-muted-foreground text-xs uppercase">
              <th className="text-left font-semibold pb-3">Page</th>
              <th className="text-right font-semibold pb-3">Sessions</th>
              <th className="text-right font-semibold pb-3 w-32">% of total</th>
            </tr>
          </thead>
          <tbody>
            {data.top_pages.map((p) => (
              <tr key={p.path} className="border-t border-border">
                <td className="py-3 text-sm truncate max-w-md" title={p.path}>
                  {humanizePath(p.path)}
                </td>
                <td className="py-3 text-right tabular-nums font-data">
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
