// Branded HTML for the monthly SEO report. Inline-styled so Playwright's
// print-to-PDF renders correctly without needing Tailwind to load.
//
// Design notes (V2):
// - Light theme (white bg, dark text) — prints clean, matches SEMrush/Ahrefs
//   industry norms for client-facing reports, easier to read at 100% zoom.
// - Niewdel wordmark embedded as base64 in the header (left-aligned).
// - Structure: bottom-line headline first → score cards → 30-day trends →
//   what changed → what needs attention → resolved wins → footer.
// - @page margin = 0; padding lives on .container so the report prints
//   edge-to-edge with no white bars on the borders.

import { readFileSync } from "node:fs";
import { join } from "node:path";

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
  period_label: string;
  generated_at: string;

  current: {
    technical: number | null;
    onpage: number | null;
    lighthouse_mobile: number | null;
    lighthouse_desktop: number | null;
    pages_crawled: number | null;
    freshness_days: number | null;
  };

  deltas: {
    technical: number | null;
    onpage: number | null;
    lighthouse_mobile: number | null;
    lighthouse_desktop: number | null;
  };

  history: ScoreHistoryPoint[];

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

// ---------------------------------------------------------------------------
// Logo loading — embed the wordmark as base64 once per process. The file is
// ~163KB so the inflate is cheap and we avoid network fetches inside the
// Playwright sandbox.
// ---------------------------------------------------------------------------
let logoCache: string | null = null;
function getLogoDataUri(): string {
  if (logoCache) return logoCache;
  try {
    const path = join(process.cwd(), "public/logos/niewdel-wordmark.png");
    const bytes = readFileSync(path);
    logoCache = `data:image/png;base64,${bytes.toString("base64")}`;
  } catch {
    logoCache = ""; // graceful fallback — header still renders without logo
  }
  return logoCache;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Score color thresholds — green/amber/red on a light background.
function scoreColor(s: number | null): string {
  if (s == null) return "#9CA3AF";
  if (s >= 85) return "#059669"; // emerald-600
  if (s >= 65) return "#D97706"; // amber-600
  return "#DC2626"; // red-600
}

function deltaPill(d: number | null): string {
  if (d == null || d === 0) return "";
  const positive = d > 0;
  const sign = positive ? "+" : "";
  const bg = positive ? "#D1FAE5" : "#FEE2E2";
  const fg = positive ? "#065F46" : "#991B1B";
  const arrow = positive ? "&uarr;" : "&darr;";
  return `<span style="display:inline-block;margin-left:6px;padding:1px 6px;font-size:10px;font-weight:600;background:${bg};color:${fg};border-radius:9999px;">${arrow} ${sign}${d}</span>`;
}

function severityBg(sev: string): { bg: string; fg: string; label: string } {
  switch (sev) {
    case "critical":
      return { bg: "#FEE2E2", fg: "#991B1B", label: "Critical" };
    case "high":
      return { bg: "#FEF3C7", fg: "#92400E", label: "High" };
    case "medium":
      return { bg: "#FEF9C3", fg: "#854D0E", label: "Medium" };
    default:
      return { bg: "#F3F4F6", fg: "#4B5563", label: "Low" };
  }
}

// Render a tiny inline SVG sparkline for a single series.
function sparkline(
  history: ScoreHistoryPoint[],
  key: keyof Omit<ScoreHistoryPoint, "created_at">,
  color: string,
  width = 240,
  height = 36
): string {
  if (history.length < 2) {
    return `<div style="width:${width}px;height:${height}px;display:flex;align-items:center;color:#9CA3AF;font-size:10px;">More data needed</div>`;
  }
  const segs: string[] = [];
  let inSeg = false;
  history.forEach((p, i) => {
    const v = p[key];
    if (v == null) {
      inSeg = false;
      return;
    }
    const x = (i / (history.length - 1)) * width;
    const y = height - (Math.max(0, Math.min(100, v)) / 100) * height;
    segs.push(`${inSeg ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`);
    inSeg = true;
  });
  return `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" style="display:block;">
    <path d="${segs.join(" ")}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}

// Build a one-line bottom-line headline from the deltas. Falls back to a
// neutral statement when nothing notable happened.
function bottomLine(d: MonthlyReportData): string {
  const ds = [
    d.deltas.technical ?? 0,
    d.deltas.onpage ?? 0,
    d.deltas.lighthouse_mobile ?? 0,
    d.deltas.lighthouse_desktop ?? 0,
  ];
  const sum = ds.reduce((a, b) => a + b, 0);
  const fixed = d.resolved_issues.length;
  const opened = d.top_issues.length;

  if (sum >= 5 && fixed > opened) {
    return `Strong month — scores up ${sum} points overall and ${fixed} issues resolved.`;
  }
  if (sum >= 5) {
    return `Scores trending up — ${sum} points gained overall this period.`;
  }
  if (sum <= -5) {
    return `Scores dipped this period — down ${Math.abs(sum)} points overall. ${opened} priority items below.`;
  }
  if (fixed > 0 && opened === 0) {
    return `${fixed} issue${fixed === 1 ? "" : "s"} resolved this month with no new high-severity items detected.`;
  }
  if (opened > 0) {
    return `${opened} priority item${opened === 1 ? "" : "s"} flagged this month — see action list below.`;
  }
  return "Site is holding steady this month — no major movement in scores or issues.";
}

export function renderMonthlyReportHtml(d: MonthlyReportData): string {
  const logo = getLogoDataUri();
  const generatedDate = new Date(d.generated_at).toLocaleDateString("en-US", {
    dateStyle: "long",
  });

  const issuesHtml =
    d.top_issues.length === 0
      ? `<div style="padding:18px;background:#ECFDF5;border:1px solid #A7F3D0;border-radius:8px;color:#065F46;font-size:13px;">
           &#10003; No critical or high-priority issues open this period. Keep doing what you&rsquo;re doing.
         </div>`
      : d.top_issues
          .map((i, idx) => {
            const s = severityBg(i.severity);
            return `
        <div style="display:flex;align-items:flex-start;gap:14px;padding:14px 0;border-bottom:1px solid #E5E7EB;">
          <div style="width:24px;height:24px;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:#F3F4F6;border-radius:50%;font-size:11px;font-weight:600;color:#4B5563;">${idx + 1}</div>
          <div style="flex:1;min-width:0;">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px;">
              <span style="display:inline-block;padding:2px 8px;font-size:10px;font-weight:600;background:${s.bg};color:${s.fg};border-radius:4px;text-transform:uppercase;letter-spacing:0.04em;">${s.label}</span>
              <span style="font-size:11px;color:#6B7280;text-transform:capitalize;">${escapeHtml(i.category)}</span>
            </div>
            <div style="font-size:14px;color:#111827;font-weight:500;line-height:1.4;">${escapeHtml(i.title)}</div>
            ${
              i.page_url
                ? `<div style="font-size:11px;color:#6B7280;font-family:ui-monospace,Menlo,monospace;margin-top:3px;word-break:break-all;">${escapeHtml(i.page_url)}</div>`
                : ""
            }
          </div>
        </div>`;
          })
          .join("");

  const resolvedHtml =
    d.resolved_issues.length === 0
      ? ""
      : `<div class="section">
          <div class="section-title">Recently resolved</div>
          <div class="card" style="padding:8px 16px;">
            ${d.resolved_issues
              .map(
                (i) => `
              <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #F3F4F6;">
                <span style="display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;background:#D1FAE5;color:#065F46;border-radius:50%;font-size:10px;flex-shrink:0;">&#10003;</span>
                <span style="font-size:13px;color:#111827;flex:1;">${escapeHtml(i.title)}</span>
                <span style="font-size:10px;color:#6B7280;text-transform:capitalize;">${escapeHtml(i.category)}</span>
              </div>`
              )
              .join("")}
          </div>
        </div>`;

  const scoreCard = (
    label: string,
    score: number | null,
    delta: number | null
  ): string => `
    <div style="padding:18px;background:#F9FAFB;border:1px solid #E5E7EB;border-radius:10px;">
      <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.06em;color:#6B7280;font-weight:600;">${label}</div>
      <div style="display:flex;align-items:baseline;gap:4px;margin-top:8px;">
        <span style="font-size:34px;font-weight:700;color:${scoreColor(score)};line-height:1;">${
          score == null ? "&mdash;" : score
        }</span>
        <span style="font-size:14px;color:#9CA3AF;font-weight:500;">/100</span>
      </div>
      <div style="margin-top:6px;height:18px;">${deltaPill(delta)}</div>
    </div>`;

  const sparkRow = (label: string, key: keyof Omit<ScoreHistoryPoint, "created_at">, color: string, current: number | null) => `
    <div style="display:grid;grid-template-columns:96px 1fr 60px;gap:14px;align-items:center;padding:10px 0;border-bottom:1px solid #F3F4F6;">
      <div style="font-size:12px;color:#4B5563;font-weight:500;">${label}</div>
      ${sparkline(d.history, key, color)}
      <div style="text-align:right;font-family:ui-monospace,Menlo,monospace;font-size:14px;font-weight:600;color:${scoreColor(current)};">${current == null ? "&mdash;" : current}</div>
    </div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(d.client_name)} &mdash; SEO Report &mdash; ${escapeHtml(d.period_label)}</title>
  <style>
    @page { size: letter; margin: 0; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", system-ui, sans-serif;
      background: #FFFFFF;
      color: #111827;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      font-size: 13px;
      line-height: 1.5;
    }
    h1, h2, h3 { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", system-ui, sans-serif; margin: 0; }
    .container { padding: 32px 40px 28px 40px; max-width: 760px; margin: 0 auto; }

    /* Header */
    .header { display:flex; justify-content:space-between; align-items:flex-start; padding-bottom: 22px; border-bottom: 1px solid #E5E7EB; margin-bottom: 24px; }
    .header-left { flex: 1; min-width: 0; }
    .eyebrow { font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: #6B7280; font-weight: 600; }
    .header h1 { font-size: 28px; font-weight: 700; letter-spacing: -0.02em; margin: 6px 0 4px 0; color: #111827; }
    .header .meta { font-size: 13px; color: #6B7280; }
    .logo-wrap { padding-top: 4px; }
    .logo-wrap img { max-height: 32px; width: auto; display: block; }

    /* Bottom-line callout */
    .lead {
      background: #F9FAFB;
      border-left: 3px solid #111827;
      padding: 18px 22px;
      border-radius: 6px;
      margin-bottom: 24px;
    }
    .lead .headline { font-size: 16px; font-weight: 600; color: #111827; line-height: 1.4; margin-bottom: 8px; }
    .lead .summary { font-size: 13px; color: #4B5563; line-height: 1.6; }

    /* Score cards */
    .score-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 28px; }

    /* Sections */
    .section { margin-top: 28px; page-break-inside: avoid; }
    .section-title { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #6B7280; margin-bottom: 12px; font-weight: 600; }
    .card { background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 10px; padding: 18px; }

    /* What changed strip */
    .changed-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
    .stat-tile { padding: 14px 16px; background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 8px; }
    .stat-tile .label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: #6B7280; font-weight: 600; }
    .stat-tile .value { font-size: 22px; font-weight: 700; color: #111827; margin-top: 4px; line-height: 1; }
    .stat-tile .help { font-size: 11px; color: #9CA3AF; margin-top: 4px; }

    /* Footer */
    .footer { margin-top: 40px; padding-top: 18px; border-top: 1px solid #E5E7EB; display: flex; justify-content: space-between; align-items: center; font-size: 10px; color: #9CA3AF; }
    .footer-logo { height: 16px; width: auto; opacity: 0.7; }
  </style>
</head>
<body>
  <div class="container">

    <!-- Header -->
    <div class="header">
      <div class="header-left">
        <div class="eyebrow">SEO Monthly Report</div>
        <h1>${escapeHtml(d.client_name)}</h1>
        <div class="meta">
          ${escapeHtml(d.domain)} &middot; ${escapeHtml(d.period_label)}
          ${d.current.pages_crawled != null ? ` &middot; ${d.current.pages_crawled} pages monitored` : ""}
          ${d.current.freshness_days != null ? ` &middot; ${d.current.freshness_days}d median content age` : ""}
        </div>
      </div>
      ${logo ? `<div class="logo-wrap"><img src="${logo}" alt="Niewdel" /></div>` : ""}
    </div>

    <!-- Bottom-line callout -->
    <div class="lead">
      <div class="headline">${escapeHtml(bottomLine(d))}</div>
      ${d.ai_summary ? `<div class="summary">${escapeHtml(d.ai_summary)}</div>` : ""}
    </div>

    <!-- Score cards -->
    <div class="score-grid">
      ${scoreCard("Technical", d.current.technical, d.deltas.technical)}
      ${scoreCard("On-page", d.current.onpage, d.deltas.onpage)}
      ${scoreCard("Mobile", d.current.lighthouse_mobile, d.deltas.lighthouse_mobile)}
      ${scoreCard("Desktop", d.current.lighthouse_desktop, d.deltas.lighthouse_desktop)}
    </div>

    <!-- What changed -->
    <div class="section">
      <div class="section-title">What changed this period</div>
      <div class="changed-grid">
        <div class="stat-tile">
          <div class="label">New issues</div>
          <div class="value" style="color:${d.top_issues.length > 0 ? "#DC2626" : "#111827"};">${d.top_issues.length}</div>
          <div class="help">High &amp; critical only</div>
        </div>
        <div class="stat-tile">
          <div class="label">Resolved</div>
          <div class="value" style="color:${d.resolved_issues.length > 0 ? "#059669" : "#111827"};">${d.resolved_issues.length}</div>
          <div class="help">Across all severities</div>
        </div>
        <div class="stat-tile">
          <div class="label">Pages tracked</div>
          <div class="value">${d.current.pages_crawled ?? "&mdash;"}</div>
          <div class="help">${d.current.freshness_days != null ? `${d.current.freshness_days}d median age` : "Crawled this run"}</div>
        </div>
      </div>
    </div>

    <!-- 30-day trends -->
    <div class="section">
      <div class="section-title">30-day score trends</div>
      <div class="card" style="padding: 6px 18px;">
        ${sparkRow("Technical", "technical_score", "#059669", d.current.technical)}
        ${sparkRow("On-page", "onpage_score", "#D97706", d.current.onpage)}
        ${sparkRow("Mobile", "lighthouse_mobile", "#2563EB", d.current.lighthouse_mobile)}
        ${sparkRow("Desktop", "lighthouse_desktop", "#7C3AED", d.current.lighthouse_desktop)}
      </div>
    </div>

    <!-- Top issues -->
    <div class="section">
      <div class="section-title">What needs attention</div>
      <div class="card" style="padding: 0 18px;">
        ${issuesHtml}
      </div>
    </div>

    ${resolvedHtml}

    <!-- Footer -->
    <div class="footer">
      <div>Generated ${escapeHtml(generatedDate)}</div>
      <div style="display:flex;align-items:center;gap:8px;">
        <span>Delivered by</span>
        ${logo ? `<img src="${logo}" class="footer-logo" alt="Niewdel" />` : `<strong>Niewdel</strong>`}
      </div>
    </div>

  </div>
</body>
</html>`;
}
