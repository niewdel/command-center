// Branded HTML for the monthly SEO report. Inline-styled so Playwright's
// print-to-PDF renders correctly without needing Tailwind to load.

// Local copy of ScoreHistoryPoint shape — duplicated to keep this server module
// free of "use client" imports (the chart lives in a client component).
export interface ScoreHistoryPoint {
  created_at: string;
  technical_score: number | null;
  onpage_score: number | null;
  lighthouse_mobile: number | null;
  lighthouse_desktop: number | null;
}

export interface MonthlyReportData {
  client_name: string;
  domain: string;
  period_label: string; // e.g., "April 2026"
  generated_at: string; // ISO

  current: {
    technical: number | null;
    onpage: number | null;
    lighthouse_mobile: number | null;
    lighthouse_desktop: number | null;
    pages_crawled: number | null;
    freshness_days: number | null;
  };

  // 30-day deltas (current - check_30d_ago).
  deltas: {
    technical: number | null;
    onpage: number | null;
    lighthouse_mobile: number | null;
    lighthouse_desktop: number | null;
  };

  history: ScoreHistoryPoint[]; // chronological, oldest → newest

  top_issues: Array<{
    severity: "critical" | "high" | "medium" | "low";
    title: string;
    page_url: string | null;
    category: string;
  }>;
  resolved_issues: Array<{
    title: string;
    category: string;
  }>;

  ai_summary: string | null;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function scoreColor(s: number | null): string {
  if (s == null) return "#9CA3AF";
  if (s >= 85) return "#10B981";
  if (s >= 65) return "#F59E0B";
  return "#EF4444";
}

function deltaBadge(d: number | null): string {
  if (d == null || d === 0) return "";
  const sign = d > 0 ? "+" : "";
  const color = d > 0 ? "#10B981" : "#EF4444";
  return `<span style="font-size:11px;color:${color};margin-left:6px;">${sign}${d}</span>`;
}

function severityColor(sev: string): string {
  switch (sev) {
    case "critical":
      return "#EF4444";
    case "high":
      return "#F59E0B";
    case "medium":
      return "#FCD34D";
    default:
      return "#9CA3AF";
  }
}

// Render a tiny inline SVG sparkline for a single series.
function sparkline(
  history: ScoreHistoryPoint[],
  key: keyof Omit<ScoreHistoryPoint, "created_at">,
  color: string
): string {
  const w = 220;
  const h = 40;
  if (history.length < 2) {
    return `<div style="width:${w}px;height:${h}px;color:#9CA3AF;font-size:10px;display:flex;align-items:center;">need 2+ checks</div>`;
  }
  const segs: string[] = [];
  let inSeg = false;
  history.forEach((p, i) => {
    const v = p[key];
    if (v == null) {
      inSeg = false;
      return;
    }
    const x = (i / (history.length - 1)) * w;
    const y = h - (Math.max(0, Math.min(100, v)) / 100) * h;
    segs.push(`${inSeg ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`);
    inSeg = true;
  });
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
    <path d="${segs.join(" ")}" fill="none" stroke="${color}" stroke-width="1.5"/>
  </svg>`;
}

export function renderMonthlyReportHtml(d: MonthlyReportData): string {
  const issuesHtml =
    d.top_issues.length === 0
      ? `<div style="color:#10B981;font-size:13px;">No critical or high-priority issues open this period.</div>`
      : d.top_issues
          .map(
            (i) => `
        <div style="padding:10px 0;border-bottom:1px solid #1F2937;">
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="display:inline-block;padding:1px 6px;font-size:10px;text-transform:uppercase;letter-spacing:0.04em;background:${severityColor(
              i.severity
            )}22;color:${severityColor(i.severity)};border-radius:3px;">${i.severity}</span>
            <span style="font-size:10px;color:#9CA3AF;">${escapeHtml(i.category)}</span>
          </div>
          <div style="font-size:13px;color:#E5E7EB;margin-top:3px;">${escapeHtml(i.title)}</div>
          ${
            i.page_url
              ? `<div style="font-size:11px;color:#6B7280;font-family:ui-monospace,Menlo,monospace;margin-top:2px;">${escapeHtml(
                  i.page_url
                )}</div>`
              : ""
          }
        </div>`
          )
          .join("");

  const resolvedHtml =
    d.resolved_issues.length === 0
      ? `<div style="color:#9CA3AF;font-size:13px;font-style:italic;">No issues resolved this period.</div>`
      : d.resolved_issues
          .map(
            (i) => `
        <div style="padding:6px 0;display:flex;align-items:center;gap:8px;">
          <span style="color:#10B981;font-weight:bold;">&#10003;</span>
          <span style="font-size:13px;color:#E5E7EB;">${escapeHtml(i.title)}</span>
          <span style="font-size:10px;color:#9CA3AF;">${escapeHtml(i.category)}</span>
        </div>`
          )
          .join("");

  const scoreCard = (
    label: string,
    score: number | null,
    delta: number | null
  ): string => `
    <div style="padding:14px;background:#0F172A;border:1px solid #1F2937;border-radius:8px;">
      <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.06em;color:#9CA3AF;">${label}</div>
      <div style="display:flex;align-items:baseline;gap:6px;margin-top:6px;">
        <span style="font-size:32px;font-weight:600;color:${scoreColor(score)};">${
          score == null ? "—" : score
        }</span>
        ${deltaBadge(delta)}
      </div>
    </div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(d.client_name)} — SEO Monthly Report — ${escapeHtml(d.period_label)}</title>
  <style>
    @page { size: letter; margin: 18mm 14mm; }
    body { margin:0; padding:0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", system-ui, sans-serif; background:#0B0F19; color:#E5E7EB; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    h1, h2, h3 { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", system-ui, sans-serif; }
    .container { padding: 24px 28px; max-width: 760px; margin: 0 auto; }
    .header { border-bottom: 1px solid #1F2937; padding-bottom: 18px; margin-bottom: 22px; }
    .grid-4 { display:grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 24px; }
    .section { margin-top: 28px; }
    .section-title { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #9CA3AF; margin-bottom: 10px; }
    .card { background:#0F172A; border:1px solid #1F2937; border-radius:8px; padding:16px; }
    .spark-row { display:grid; grid-template-columns: 90px 1fr 50px; gap:12px; align-items:center; padding:6px 0; border-bottom:1px solid #1F2937; }
    .spark-row:last-child { border-bottom: none; }
    .spark-label { font-size:11px; color:#9CA3AF; }
    .spark-current { text-align:right; font-family: ui-monospace, Menlo, monospace; font-size:13px; }
    .footer { margin-top: 32px; padding-top: 14px; border-top:1px solid #1F2937; font-size:10px; color:#6B7280; text-align:center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#9CA3AF;">SEO Monthly Report</div>
      <h1 style="margin:6px 0 4px 0;font-size:26px;font-weight:600;letter-spacing:-0.01em;">${escapeHtml(d.client_name)}</h1>
      <div style="font-size:13px;color:#9CA3AF;">
        ${escapeHtml(d.domain)} &middot; ${escapeHtml(d.period_label)}
        ${
          d.current.pages_crawled != null
            ? ` &middot; ${d.current.pages_crawled} pages monitored`
            : ""
        }
        ${
          d.current.freshness_days != null
            ? ` &middot; ${d.current.freshness_days}d median content age`
            : ""
        }
      </div>
    </div>

    <div class="grid-4">
      ${scoreCard("Technical", d.current.technical, d.deltas.technical)}
      ${scoreCard("On-page", d.current.onpage, d.deltas.onpage)}
      ${scoreCard("Mobile", d.current.lighthouse_mobile, d.deltas.lighthouse_mobile)}
      ${scoreCard("Desktop", d.current.lighthouse_desktop, d.deltas.lighthouse_desktop)}
    </div>

    ${
      d.ai_summary
        ? `<div class="section">
        <div class="section-title">Executive summary</div>
        <div class="card" style="border-left: 2px solid #3B82F6;">
          <div style="font-size:13px;line-height:1.6;color:#E5E7EB;">${escapeHtml(d.ai_summary)}</div>
        </div>
      </div>`
        : ""
    }

    <div class="section">
      <div class="section-title">30-day trend</div>
      <div class="card">
        <div class="spark-row">
          <div class="spark-label">Technical</div>
          ${sparkline(d.history, "technical_score", "#10B981")}
          <div class="spark-current" style="color:${scoreColor(d.current.technical)};">${d.current.technical ?? "—"}</div>
        </div>
        <div class="spark-row">
          <div class="spark-label">On-page</div>
          ${sparkline(d.history, "onpage_score", "#F59E0B")}
          <div class="spark-current" style="color:${scoreColor(d.current.onpage)};">${d.current.onpage ?? "—"}</div>
        </div>
        <div class="spark-row">
          <div class="spark-label">Mobile</div>
          ${sparkline(d.history, "lighthouse_mobile", "#3B82F6")}
          <div class="spark-current" style="color:${scoreColor(d.current.lighthouse_mobile)};">${d.current.lighthouse_mobile ?? "—"}</div>
        </div>
        <div class="spark-row">
          <div class="spark-label">Desktop</div>
          ${sparkline(d.history, "lighthouse_desktop", "#8B5CF6")}
          <div class="spark-current" style="color:${scoreColor(d.current.lighthouse_desktop)};">${d.current.lighthouse_desktop ?? "—"}</div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Top open issues</div>
      <div class="card">${issuesHtml}</div>
    </div>

    <div class="section">
      <div class="section-title">Resolved this period</div>
      <div class="card">${resolvedHtml}</div>
    </div>

    <div class="footer">
      Generated ${new Date(d.generated_at).toLocaleDateString("en-US", { dateStyle: "long" })}
    </div>
  </div>
</body>
</html>`;
}
