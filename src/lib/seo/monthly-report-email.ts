// Email-safe HTML renderer for the monthly SEO report.
//
// Rules (non-negotiable for cross-client compatibility):
//   - Inline styles only. No <style> blocks, no class selectors.
//   - Table-based layout. <table role="presentation" ...> for all layout.
//   - Hex colors only. No oklch(), no var(--...), no currentColor.
//   - System font stack only. No Google Fonts, no @font-face. (Email clients
//     strip web fonts; the brand's geometric-sans feel comes through a
//     system sans, weight, and Niewdel Blue, not a font download.)
//   - Max 600px wide.
//   - No JavaScript.
//
// Brand: Niewdel Brand Guidelines v3.0 (June 2026) — dark-first.
//   - Jet Black page, Onyx cards, Niewdel Blue as the single chromatic
//     accent, Cloud White text, Deep Navy for the score hero's depth.
//   - No gradients, no glow. Mono-tag eyebrow on every section.
//   - Voice: direct, no em-dashes, no buzzwords.
//   - DELIBERATELY trimmed for a non-technical small-business audience.
//     The client email shows only what they understand and care about:
//     one health grade, visitors, top pages, Google rankings, what we
//     fixed, and Google Ads — then a plain-English summary.
//   - Cut from the client email (still in the operator's in-app view):
//     the four technical score cards (Technical/On-Page/Lighthouse), the
//     open-issues severity breakdown, the "what needs attention" issue
//     list, and the traffic-source % split. These are internal triage,
//     not client deliverables.
//   - Exception: AI Search (AEO) gets its own compact single-metric card
//     right after the score hero (Task 11) — it's the differentiator we're
//     selling, so it stays even though the rest of the technical grid is cut.

import type { ReportData } from "./report-data";
import { humanizePath } from "./page-name";

// ── Brand colors, email-safe hex (Niewdel v3.0, dark-first) ─────────────────
const BG = "#0D0D0D"; // Jet Black — page background
const CARD = "#1A1A1A"; // Onyx — cards / surfaces
const ELEVATED = "#141719"; // raised / inset panels
const LINE = "#262B2E"; // hairline borders
const TEXT = "#F5F5F5"; // Cloud White — primary text
const MUTED = "#9AA3A8"; // secondary text
const FAINT = "#5C666D"; // faint text / captions
const BLUE = "#3B86DB"; // Niewdel Blue — the single accent
const BLUE_SOFT = "#9DBEE8"; // light blue for eyebrows on Navy/dark fills
const NAVY = "#1B4D8F"; // Deep Navy — score-hero fill, depth
const SUCCESS = "#35B37E"; // improvement — matches web --pos
const ERROR = "#D85A52"; // regression — matches web --neg

const FONT =
  "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;";

// Eyebrow tag, used as the section opener throughout. Uppercase + wide
// tracking in Niewdel Blue, per the brand's eyebrow-label spec.
function tag(text: string, color = BLUE): string {
  return `<p style="margin:0 0 12px 0;${FONT}font-size:11px;font-weight:700;color:${color};text-transform:uppercase;letter-spacing:0.22em;">${text}</p>`;
}

// Email-safe horizontal bar: a filled track built from <td> widths — no SVG,
// no CSS-only bars, so it renders in Gmail, Outlook, and Apple Mail alike.
function bar(pct: number, fill: string, track: string, height = 8): string {
  const p = Math.max(0, Math.min(100, Math.round(pct)));
  const r = Math.round(height / 2);
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-radius:${r}px;overflow:hidden;background:${track};">
  <tr>${p > 0 ? `<td width="${p}%" style="height:${height}px;background:${fill};font-size:0;line-height:0;">&nbsp;</td>` : ""}${p < 100 ? `<td style="height:${height}px;font-size:0;line-height:0;">&nbsp;</td>` : ""}</tr>
</table>`;
}

// Email-safe stacked bar: one row of colored <td> segments summing to ~100%.
function stackedBar(
  segments: { pct: number; color: string }[],
  track: string,
  height = 10,
): string {
  const cells = segments
    .filter((s) => s.pct > 0)
    .map(
      (s) =>
        `<td width="${Math.round(s.pct)}%" style="height:${height}px;background:${s.color};font-size:0;line-height:0;">&nbsp;</td>`,
    )
    .join("");
  const r = Math.round(height / 2);
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-radius:${r}px;overflow:hidden;background:${track};">
  <tr>${cells || `<td style="height:${height}px;font-size:0;line-height:0;">&nbsp;</td>`}</tr>
</table>`;
}

// Traffic-source palette (blue = search, greens/greys = the rest), matched to
// the web report's tone.
const SOURCE_SEGMENTS: { key: "search" | "direct" | "referral" | "social" | "other"; label: string; color: string }[] = [
  { key: "search", label: "Search", color: "#3B86DB" },
  { key: "social", label: "Social", color: "#35B37E" },
  { key: "direct", label: "Direct", color: "#6B757C" },
  { key: "referral", label: "Referral", color: "#8B95A0" },
  { key: "other", label: "Other", color: "#5C666D" },
];

export function renderMonthlyReportEmail(
  data: ReportData,
  opts: { intro?: string } = {},
): string {
  const generatedDate = new Date(data.client.generated_at).toLocaleDateString(
    "en-US",
    { month: "long", day: "numeric", year: "numeric" },
  );

  function escapeHtml(s: string): string {
    return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function formatNumber(n: number): string {
    return n.toLocaleString("en-US");
  }

  // Deltas. Improvement = success green, regression = error red, neutral =
  // faint. Niewdel Blue stays reserved for accents, not data signals.
  type DeltaDisplay = { arrow: string; color: string; text: string };

  function formatTrafficDelta(delta: number | null): DeltaDisplay {
    if (delta == null) return { arrow: "—", color: FAINT, text: "no prior" };
    if (delta > 0) return { arrow: "↑", color: SUCCESS, text: `+${formatNumber(delta)}` };
    if (delta < 0) return { arrow: "↓", color: ERROR, text: formatNumber(delta) };
    return { arrow: "—", color: FAINT, text: "flat" };
  }
  // Keywords: lower rank = improvement.
  function formatRankDelta(delta: number | null): DeltaDisplay {
    if (delta == null) return { arrow: "—", color: FAINT, text: "new" };
    if (delta < 0) return { arrow: "↑", color: SUCCESS, text: `${Math.abs(delta)}` };
    if (delta > 0) return { arrow: "↓", color: ERROR, text: `${delta}` };
    return { arrow: "—", color: FAINT, text: "flat" };
  }

  // ── Section builders ──────────────────────────────────────────────────────

  function buildHeader(): string {
    return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
  <tr>
    <td style="padding:40px 32px 24px 32px;">
      ${tag(`SEO Report · ${escapeHtml(data.client.period_label)}`)}
      <h1 style="margin:0 0 12px 0;${FONT}font-size:30px;font-weight:700;color:${TEXT};line-height:1.15;letter-spacing:-0.015em;">${escapeHtml(data.client.name)}<span style="color:${BLUE};">.</span></h1>
      <div style="width:40px;height:3px;background:${BLUE};background:linear-gradient(135deg,${BLUE},${NAVY});border-radius:2px;margin:0 0 12px 0;font-size:0;line-height:0;">&nbsp;</div>
      <p style="margin:0;${FONT}font-size:14px;color:${MUTED};">${escapeHtml(data.client.domain)}</p>
    </td>
  </tr>
</table>`;
  }

  function buildOverallScoreHero(): string {
    const score = data.health.overall_score;
    const delta = data.health.overall_delta;
    const scoreDisplay = score != null ? String(score) : "—";
    const deltaLine =
      delta != null
        ? `${delta > 0 ? "+" : ""}${delta} since the start of this period.`
        : "First report, no prior window to compare.";

    return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
  <tr>
    <td style="padding:0 32px 24px 32px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${NAVY};border-radius:12px;">
        <tr>
          <td style="padding:28px;">
            <p style="margin:0 0 12px 0;${FONT}font-size:11px;font-weight:700;color:${BLUE_SOFT};text-transform:uppercase;letter-spacing:0.22em;">Overall Score</p>
            <p style="margin:0;${FONT}font-size:60px;font-weight:700;color:${TEXT};line-height:1;letter-spacing:-0.025em;font-feature-settings:'tnum';">${escapeHtml(scoreDisplay)}<span style="font-size:20px;font-weight:500;color:${BLUE_SOFT};margin-left:6px;opacity:0.7;">/100</span></p>
            <div style="margin:16px 0 0 0;">${bar(score ?? 0, "#7FB0EA", "#123A6B", 10)}</div>
            <p style="margin:14px 0 0 0;${FONT}font-size:13px;color:#C7D6EA;">${escapeHtml(deltaLine)}</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
  }

  // Compact single-metric AEO card, right after the overall-score hero.
  // Deliberately NOT the full Technical/On-Page/Lighthouse grid (cut from
  // the client email — see file header) but this one metric is surfaced on
  // its own because it's the modern differentiator: how visible the client
  // is to ChatGPT, Perplexity, and Google AI Overviews.
  function aeoScoreLabel(score: number | null): string {
    if (score == null) return "Getting started";
    if (score >= 76) return "Strong";
    if (score >= 51) return "On track";
    return "Building";
  }

  function buildAeoCard(): string {
    const card = data.health.aeo;
    const scoreDisplay = card.current != null ? String(card.current) : "—";
    const label = aeoScoreLabel(card.current);
    const showDelta = card.delta != null && card.delta > 0;

    return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
  <tr>
    <td style="padding:0 32px 24px 32px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${CARD};border:1px solid ${LINE};border-radius:10px;">
        <tr>
          <td style="padding:18px;">
            <p style="margin:0 0 4px 0;${FONT}font-size:10px;font-weight:700;color:${MUTED};text-transform:uppercase;letter-spacing:0.18em;">AI Search (AEO)</p>
            <p style="margin:0 0 4px 0;${FONT}font-size:36px;font-weight:700;color:${TEXT};font-feature-settings:'tnum';letter-spacing:-0.025em;">${escapeHtml(scoreDisplay)}<span style="font-size:14px;font-weight:500;color:${MUTED};margin-left:6px;">/100 · ${escapeHtml(label)}</span></p>
            ${
              showDelta
                ? `<p style="margin:0;${FONT}font-size:12px;color:${SUCCESS};font-feature-settings:'tnum';">↑ +${card.delta} since the start of this period.</p>`
                : `<p style="margin:0;${FONT}font-size:12px;color:${MUTED};">How visible you are to ChatGPT, Perplexity, and Google AI Overviews.</p>`
            }
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
  }

  function buildTrafficSection(): string {
    if (!data.traffic) return "";
    const t = data.traffic;
    const sessD = formatTrafficDelta(t.sessions.delta);
    const orgD = formatTrafficDelta(t.organic_sessions.delta);

    const periodStart = new Date(t.period_start).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    const periodEnd = new Date(t.period_end).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });

    // Plain-English Google line: how many visits came from search, and which
    // way that's trending. Organic visits are the number that proves SEO is
    // working, so we surface it as one sentence instead of a metrics grid.
    const fromGoogle = `${formatNumber(t.organic_sessions.current)} of those came from Google search`;
    const orgTrend =
      t.organic_sessions.delta != null && t.organic_sessions.delta !== 0
        ? ` (${orgD.arrow} ${orgD.text})`
        : "";

    return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
  <tr>
    <td style="padding:0 32px 8px 32px;">
      ${tag("01 · Visitors")}
    </td>
  </tr>
  <tr>
    <td style="padding:0 32px 24px 32px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${CARD};border:1px solid ${LINE};border-radius:10px;">
        <tr>
          <td style="padding:18px;">
            <p style="margin:0 0 4px 0;${FONT}font-size:10px;font-weight:700;color:${MUTED};text-transform:uppercase;letter-spacing:0.18em;">Visits</p>
            <p style="margin:0 0 4px 0;${FONT}font-size:36px;font-weight:700;color:${TEXT};font-feature-settings:'tnum';letter-spacing:-0.025em;">${formatNumber(t.sessions.current)}</p>
            <p style="margin:0 0 2px 0;${FONT}font-size:12px;color:${sessD.color};font-feature-settings:'tnum';">${sessD.arrow} ${escapeHtml(sessD.text)} vs last period</p>
            <p style="margin:8px 0 0 0;${FONT}font-size:13px;color:${MUTED};">${escapeHtml(fromGoogle)}<span style="color:${orgD.color};font-feature-settings:'tnum';">${orgTrend}</span>.</p>
            <p style="margin:10px 0 0 0;${FONT}font-size:12px;color:${MUTED};">Reporting period · ${escapeHtml(periodStart)} – ${escapeHtml(periodEnd)}</p>
            ${buildSourcesBar(t.sources)}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
  }

  // Stacked bar + legend of where visitors came from. Reads the source %
  // split already on the report data; renders only if it sums to something.
  function buildSourcesBar(sources: {
    search: number;
    direct: number;
    referral: number;
    social: number;
    other: number;
  }): string {
    const segs = SOURCE_SEGMENTS.map((s) => ({ ...s, pct: sources[s.key] ?? 0 }));
    if (segs.reduce((sum, s) => sum + s.pct, 0) <= 0) return "";
    const legend = segs
      .filter((s) => s.pct > 0)
      .map(
        (s) =>
          `<span style="display:inline-block;${FONT}font-size:11px;color:${MUTED};margin:0 14px 0 0;white-space:nowrap;"><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${s.color};margin-right:5px;"></span>${s.label} <span style="color:${TEXT};font-feature-settings:'tnum';">${s.pct}%</span></span>`,
      )
      .join("");
    return `
            <p style="margin:16px 0 8px 0;${FONT}font-size:10px;font-weight:700;color:${MUTED};text-transform:uppercase;letter-spacing:0.18em;">Where visitors came from</p>
            ${stackedBar(segs, ELEVATED, 10)}
            <p style="margin:10px 0 0 0;line-height:1.9;">${legend}</p>`;
  }

  function buildTopPages(): string {
    if (data.top_pages.length === 0) return "";

    // Each page renders as a labeled row (name + sessions + share) with a
    // proportional bar underneath — a mini bar chart instead of a dense table.
    const rows = data.top_pages
      .slice(0, 3)
      .map(
        (p) => `
      <tr>
        <td style="padding:14px 0 0 0;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td style="${FONT}font-size:13px;color:${TEXT};word-break:break-word;padding-right:10px;">${escapeHtml(humanizePath(p.path))}</td>
              <td style="${FONT}font-size:13px;color:${MUTED};font-feature-settings:'tnum';white-space:nowrap;text-align:right;">${formatNumber(p.sessions)} <span style="color:${FAINT};">·</span> ${p.pct_of_total}%</td>
            </tr>
          </table>
          <div style="margin:7px 0 0 0;">${bar(p.pct_of_total, BLUE, ELEVATED, 6)}</div>
        </td>
      </tr>`,
      )
      .join("");

    return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
  <tr>
    <td style="padding:0 32px 24px 32px;">
      ${tag("02 · Top Pages")}
      <table cellpadding="0" cellspacing="0" border="0" width="100%">
        <tbody>
          ${rows}
        </tbody>
      </table>
    </td>
  </tr>
</table>`;
  }

  function buildKeywordRankings(): string {
    if (!data.keywords) return "";
    const kw = data.keywords;
    const pct =
      kw.tracked_count > 0
        ? Math.round((kw.ranking_count / kw.tracked_count) * 100)
        : 0;

    const hasUp = kw.top_movers_up.length > 0;
    const hasDown = kw.top_movers_down.length > 0;

    if (!hasUp && !hasDown) {
      return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
  <tr>
    <td style="padding:0 32px 24px 32px;">
      ${tag("03 · Google Rankings")}
      <p style="margin:0;${FONT}font-size:14px;color:${MUTED};">${kw.ranking_count} of ${kw.tracked_count} phrases ranking (${pct}%). No notable movers this period.</p>
    </td>
  </tr>
</table>`;
    }

    const upRows = kw.top_movers_up
      .map((m) => {
        const d = formatRankDelta(m.delta);
        const prior = m.prior_rank != null ? `#${m.prior_rank}` : "new";
        const cur = m.rank != null ? `#${m.rank}` : "—";
        return `
        <tr>
          <td style="padding:8px 0;border-top:1px solid ${LINE};">
            <p style="margin:0 0 2px 0;${FONT}font-size:13px;color:${TEXT};">${escapeHtml(m.keyword)}</p>
            <p style="margin:0;${FONT}font-size:11px;color:${MUTED};letter-spacing:0.04em;">${prior} → ${cur} <span style="color:${SUCCESS};">${d.arrow} ${escapeHtml(d.text)}</span></p>
          </td>
        </tr>`;
      })
      .join("");

    const downRows = kw.top_movers_down
      .map((m) => {
        const d = formatRankDelta(m.delta);
        const prior = m.prior_rank != null ? `#${m.prior_rank}` : "—";
        const cur = m.rank != null ? `#${m.rank}` : "off";
        return `
        <tr>
          <td style="padding:8px 0;border-top:1px solid ${LINE};">
            <p style="margin:0 0 2px 0;${FONT}font-size:13px;color:${TEXT};">${escapeHtml(m.keyword)}</p>
            <p style="margin:0;${FONT}font-size:11px;color:${MUTED};letter-spacing:0.04em;">${prior} → ${cur} <span style="color:${ERROR};">${d.arrow} ${escapeHtml(d.text)}</span></p>
          </td>
        </tr>`;
      })
      .join("");

    return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
  <tr>
    <td style="padding:0 32px 6px 32px;">
      ${tag("03 · Google Rankings")}
      <p style="margin:0 0 16px 0;${FONT}font-size:13px;color:${MUTED};">${kw.ranking_count} of ${kw.tracked_count} phrases ranking (${pct}%).</p>
    </td>
  </tr>
  <tr>
    <td style="padding:0 32px 24px 32px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
          ${hasUp ? `<td style="width:${hasDown ? "50%" : "100%"};vertical-align:top;${hasDown ? "padding-right:12px;" : ""}">
            <p style="margin:0 0 6px 0;${FONT}font-size:10px;font-weight:700;color:${SUCCESS};text-transform:uppercase;letter-spacing:0.18em;">Climbers</p>
            <table cellpadding="0" cellspacing="0" border="0" width="100%">${upRows}</table>
          </td>` : ""}
          ${hasDown ? `<td style="width:${hasUp ? "50%" : "100%"};vertical-align:top;${hasUp ? "padding-left:12px;" : ""}">
            <p style="margin:0 0 6px 0;${FONT}font-size:10px;font-weight:700;color:${ERROR};text-transform:uppercase;letter-spacing:0.18em;">Slippage</p>
            <table cellpadding="0" cellspacing="0" border="0" width="100%">${downRows}</table>
          </td>` : ""}
        </tr>
      </table>
    </td>
  </tr>
</table>`;
  }

  function buildResolved(): string {
    if (data.issues.resolved.length === 0) return "";

    const rows = data.issues.resolved
      .map(
        (r) => `
      <tr>
        <td style="padding:8px 0;border-top:1px solid ${LINE};">
          <p style="margin:0;${FONT}font-size:13px;color:${TEXT};"><span style="color:${SUCCESS};font-weight:700;">✓</span> ${escapeHtml(r.title)}</p>
        </td>
      </tr>`,
      )
      .join("");

    return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
  <tr>
    <td style="padding:0 32px 24px 32px;">
      ${tag("04 · What we fixed", SUCCESS)}
      <table cellpadding="0" cellspacing="0" border="0" width="100%">
        ${rows}
      </table>
    </td>
  </tr>
</table>`;
  }

  function buildAds(): string {
    const ads = data.ads;
    // Three render states. "ok" with real metrics. "not_configured" /
    // "needs_reconnect" / "error" all render the same upsell placeholder
    // so the client sees a polished "you could be running ads" block
    // even when there's no data.
    if (ads.state === "ok" && ads.metrics) {
      const m = ads.metrics;
      const fmtUsd = (n: number) =>
        new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          maximumFractionDigits: 0,
        }).format(n);
      const fmtPct = (n: number) => `${(n * 100).toFixed(1)}%`;
      const fmtCpc = (n: number) => `$${n.toFixed(2)}`;

      const topRows = m.top_campaigns
        .map(
          (c) => `
        <tr>
          <td style="padding:10px 0;border-top:1px solid ${LINE};${FONT}font-size:13px;color:${TEXT};width:60%;word-break:break-word;">${escapeHtml(c.name)}</td>
          <td style="padding:10px 8px;border-top:1px solid ${LINE};${FONT}font-size:13px;color:${TEXT};font-feature-settings:'tnum';white-space:nowrap;text-align:right;">${fmtUsd(c.cost)}</td>
          <td style="padding:10px 0;border-top:1px solid ${LINE};${FONT}font-size:13px;color:${MUTED};font-feature-settings:'tnum';white-space:nowrap;text-align:right;">${formatNumber(c.clicks)}</td>
        </tr>`,
        )
        .join("");

      return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
  <tr>
    <td style="padding:0 32px 8px 32px;">
      ${tag("05 · Google Ads")}
    </td>
  </tr>
  <tr>
    <td style="padding:0 32px 16px 32px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${CARD};border:1px solid ${LINE};border-radius:10px;margin-bottom:12px;">
        <tr>
          <td style="padding:18px;">
            <p style="margin:0 0 4px 0;${FONT}font-size:10px;font-weight:700;color:${MUTED};text-transform:uppercase;letter-spacing:0.18em;">Spend</p>
            <p style="margin:0 0 4px 0;${FONT}font-size:36px;font-weight:700;color:${TEXT};font-feature-settings:'tnum';letter-spacing:-0.025em;">${fmtUsd(m.cost)}</p>
            <p style="margin:8px 0 0 0;${FONT}font-size:12px;color:${MUTED};">Reporting period · ${escapeHtml(m.period_start)} – ${escapeHtml(m.period_end)}</p>
          </td>
        </tr>
      </table>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
          <td style="width:33.33%;padding-right:6px;" valign="top">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${CARD};border:1px solid ${LINE};border-radius:10px;">
              <tr>
                <td style="padding:14px;">
                  <p style="margin:0 0 4px 0;${FONT}font-size:10px;font-weight:700;color:${MUTED};text-transform:uppercase;letter-spacing:0.18em;">Clicks</p>
                  <p style="margin:0;${FONT}font-size:22px;font-weight:700;color:${TEXT};font-feature-settings:'tnum';">${formatNumber(m.clicks)}</p>
                </td>
              </tr>
            </table>
          </td>
          <td style="width:33.33%;padding-right:6px;" valign="top">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${CARD};border:1px solid ${LINE};border-radius:10px;">
              <tr>
                <td style="padding:14px;">
                  <p style="margin:0 0 4px 0;${FONT}font-size:10px;font-weight:700;color:${MUTED};text-transform:uppercase;letter-spacing:0.18em;">Impressions</p>
                  <p style="margin:0;${FONT}font-size:22px;font-weight:700;color:${TEXT};font-feature-settings:'tnum';">${formatNumber(m.impressions)}</p>
                </td>
              </tr>
            </table>
          </td>
          <td style="width:33.33%;" valign="top">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${CARD};border:1px solid ${LINE};border-radius:10px;">
              <tr>
                <td style="padding:14px;">
                  <p style="margin:0 0 4px 0;${FONT}font-size:10px;font-weight:700;color:${MUTED};text-transform:uppercase;letter-spacing:0.18em;">CTR</p>
                  <p style="margin:0;${FONT}font-size:22px;font-weight:700;color:${TEXT};font-feature-settings:'tnum';">${fmtPct(m.ctr)}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="padding:0 32px 16px 32px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
          <td style="width:50%;padding-right:6px;" valign="top">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${CARD};border:1px solid ${LINE};border-radius:10px;">
              <tr>
                <td style="padding:14px;">
                  <p style="margin:0 0 4px 0;${FONT}font-size:10px;font-weight:700;color:${MUTED};text-transform:uppercase;letter-spacing:0.18em;">Conversions</p>
                  <p style="margin:0;${FONT}font-size:22px;font-weight:700;color:${TEXT};font-feature-settings:'tnum';">${m.conversions.toFixed(1)}</p>
                </td>
              </tr>
            </table>
          </td>
          <td style="width:50%;" valign="top">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${CARD};border:1px solid ${LINE};border-radius:10px;">
              <tr>
                <td style="padding:14px;">
                  <p style="margin:0 0 4px 0;${FONT}font-size:10px;font-weight:700;color:${MUTED};text-transform:uppercase;letter-spacing:0.18em;">${m.cost_per_conversion != null ? "Cost / Conversion" : "Avg CPC"}</p>
                  <p style="margin:0;${FONT}font-size:22px;font-weight:700;color:${TEXT};font-feature-settings:'tnum';">${m.cost_per_conversion != null ? fmtUsd(m.cost_per_conversion) : fmtCpc(m.avg_cpc)}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>
  ${m.top_campaigns.length > 0 ? `
  <tr>
    <td style="padding:0 32px 24px 32px;">
      <p style="margin:0 0 10px 0;${FONT}font-size:10px;font-weight:700;color:${MUTED};text-transform:uppercase;letter-spacing:0.18em;">Top Campaigns</p>
      <table cellpadding="0" cellspacing="0" border="0" width="100%">
        <thead>
          <tr>
            <th style="padding:0 0 6px 0;text-align:left;${FONT}font-size:10px;font-weight:700;color:${MUTED};text-transform:uppercase;letter-spacing:0.18em;">Campaign</th>
            <th style="padding:0 8px 6px 8px;text-align:right;${FONT}font-size:10px;font-weight:700;color:${MUTED};text-transform:uppercase;letter-spacing:0.18em;">Spend</th>
            <th style="padding:0 0 6px 0;text-align:right;${FONT}font-size:10px;font-weight:700;color:${MUTED};text-transform:uppercase;letter-spacing:0.18em;">Clicks</th>
          </tr>
        </thead>
        <tbody>${topRows}</tbody>
      </table>
    </td>
  </tr>
  ` : ""}
</table>`;
    }

    // Placeholder. Same block for not_configured, needs_reconnect, and
    // error states. Niewdel does NOT run ad campaigns; we only report on
    // existing ones. CTA asks the client to grant manager access so we
    // can pull their data, not to hire us to run ads.
    return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
  <tr>
    <td style="padding:0 32px 24px 32px;">
      ${tag("05 · Google Ads")}
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${CARD};border:1px dashed ${LINE};border-radius:12px;">
        <tr>
          <td style="padding:22px 26px;">
            <p style="margin:0 0 6px 0;${FONT}font-size:16px;font-weight:700;color:${TEXT};letter-spacing:-0.01em;">Link your Google Ads.</p>
            <p style="margin:0;${FONT}font-size:14px;color:${MUTED};line-height:1.6;">If you run Google Ads campaigns and want the performance included here each month, add Niewdel as a manager on your Google Ads account. We don't run the campaigns, we just pull the data for your monthly report. Reply if you'd like to set it up.</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
  }

  function buildAiSummary(): string {
    if (!data.ai_summary) return "";
    return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
  <tr>
    <td style="padding:0 32px 28px 32px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${ELEVATED};border:1px solid ${LINE};border-radius:12px;">
        <tr>
          <td style="padding:22px 26px;">
            ${tag("In plain English", MUTED)}
            <p style="margin:0;${FONT}font-size:14px;color:${TEXT};line-height:1.65;">${escapeHtml(data.ai_summary).replace(/\n\n+/g, `</p><p style="margin:12px 0 0 0;${FONT}font-size:14px;color:${TEXT};line-height:1.65;">`).replace(/\n/g, "<br/>")}</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
  }

  function buildFooter(): string {
    return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
  <tr>
    <td style="padding:24px 32px 32px 32px;border-top:1px solid ${LINE};">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
          <td style="vertical-align:middle;">
            <p style="margin:0;${FONT}font-size:15px;font-weight:700;color:${TEXT};letter-spacing:-0.01em;">niewdel</p>
            <p style="margin:3px 0 0 0;${FONT}font-size:9px;font-weight:700;color:${MUTED};text-transform:uppercase;letter-spacing:0.2em;">Growth Services</p>
          </td>
          <td style="text-align:right;vertical-align:middle;">
            <p style="margin:0;${FONT}font-size:11px;color:${MUTED};letter-spacing:0.04em;">${escapeHtml(generatedDate)}</p>
          </td>
        </tr>
      </table>
      <p style="margin:14px 0 0 0;${FONT}font-size:12px;color:${FAINT};line-height:1.5;">Questions? Just reply to this email.</p>
    </td>
  </tr>
</table>`;
  }

  // ── Assemble ──────────────────────────────────────────────────────────────

  const body = [
    opts.intro ?? "",
    buildHeader(),
    buildOverallScoreHero(),
    buildAeoCard(),
    buildTrafficSection(),
    buildTopPages(),
    buildKeywordRankings(),
    buildResolved(),
    buildAds(),
    buildAiSummary(),
    buildFooter(),
  ]
    .filter(Boolean)
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="format-detection" content="telephone=no,date=no,address=no,email=no"/>
<meta http-equiv="X-UA-Compatible" content="IE=edge"/>
<meta name="color-scheme" content="dark light"/>
<meta name="supported-color-schemes" content="dark light"/>
<title>SEO Report: ${escapeHtml(data.client.name)}</title>
</head>
<body style="margin:0;padding:0;background:${BG};${FONT}">
<!--[if mso]><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td><![endif]-->
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${BG};">
  <tr>
    <td style="padding:32px 0;" align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;background:${BG};border:1px solid ${LINE};border-radius:14px;overflow:hidden;">
        <tr>
          <td>
            ${body}
            <!-- zwnj to prevent phone-number/date auto-detection in some clients -->
            &zwnj;
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</body>
</html>`;
}
