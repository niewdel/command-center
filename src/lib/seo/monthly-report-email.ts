// Email-safe HTML renderer for the monthly SEO report.
//
// Rules (non-negotiable for cross-client compatibility):
//   - Inline styles only. No <style> blocks, no class selectors.
//   - Table-based layout. <table role="presentation" ...> for all layout.
//   - Hex colors only. No oklch(), no var(--...), no currentColor.
//   - System font stack only. No Google Fonts, no @font-face.
//   - Max 600px wide.
//   - No JavaScript.
//   - Light mode only.
//
// Editorial direction (v2.1, May 2026):
//   - Niewdel Paper/Ink/Rust palette throughout. No cyan, navy, or neon.
//   - Mono-tag eyebrow on every section, editorial column rhythm.
//   - Full analytics content from v1 (every score, traffic metric, keyword,
//     issue) is back, but copy is tight: short single-sentence captions,
//     no paragraphs of explanation. Numbers carry the meaning.

import type { ReportData, SeoIssueRowOut } from "./report-data";

// ── Brand colors, email-safe hex ────────────────────────────────────────────
const PAPER = "#F5F1EA";
const PAPER_RAISED = "#FBF8F2";
const PAPER_SUNKEN = "#EDE7DC";
const PAPER_EDGE = "#E3DDD2";
const INK = "#1A1410";
const INK_SOFT = "#665E54";
const INK_FAINT = "#8E867C";
const RUST = "#C84B31";
const RUST_HOT = "#E36548";
const RUST_DEEP = "#8F3623";
const SAGE = "#5C7F4F";
const GOLD = "#B58A5C";

const FONT =
  "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;";
const MONO =
  "font-family:'JetBrains Mono','SF Mono',Menlo,Consolas,monospace;";

// Mono eyebrow tag, used as the section opener throughout.
function tag(text: string, color = RUST): string {
  return `<p style="margin:0 0 12px 0;${MONO}font-size:11px;font-weight:600;color:${color};text-transform:uppercase;letter-spacing:0.22em;">${text}</p>`;
}

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
  function formatDecimal(n: number, places = 2): string {
    return n.toFixed(places);
  }

  // Deltas. Improvement = sage, regression = rust-deep, neutral = ink-faint.
  // (No bright red, no bright green, all warm.)
  type DeltaDisplay = { arrow: string; color: string; text: string };

  function formatScoreDelta(delta: number | null): DeltaDisplay {
    if (delta == null) return { arrow: "—", color: INK_FAINT, text: "no prior" };
    if (delta > 0) return { arrow: "↑", color: SAGE, text: `+${delta}` };
    if (delta < 0) return { arrow: "↓", color: RUST_DEEP, text: `${delta}` };
    return { arrow: "—", color: INK_FAINT, text: "flat" };
  }
  function formatTrafficDelta(delta: number | null): DeltaDisplay {
    if (delta == null) return { arrow: "—", color: INK_FAINT, text: "no prior" };
    if (delta > 0) return { arrow: "↑", color: SAGE, text: `+${formatNumber(delta)}` };
    if (delta < 0) return { arrow: "↓", color: RUST_DEEP, text: formatNumber(delta) };
    return { arrow: "—", color: INK_FAINT, text: "flat" };
  }
  // Keywords: lower rank = improvement.
  function formatRankDelta(delta: number | null): DeltaDisplay {
    if (delta == null) return { arrow: "—", color: INK_FAINT, text: "new" };
    if (delta < 0) return { arrow: "↑", color: SAGE, text: `${Math.abs(delta)}` };
    if (delta > 0) return { arrow: "↓", color: RUST_DEEP, text: `${delta}` };
    return { arrow: "—", color: INK_FAINT, text: "flat" };
  }

  function severityStyle(severity: SeoIssueRowOut["severity"]) {
    switch (severity) {
      case "critical":
        return { bg: PAPER_SUNKEN, border: RUST_DEEP, text: RUST_DEEP, label: "Critical" };
      case "high":
        return { bg: PAPER_SUNKEN, border: GOLD, text: GOLD, label: "High" };
      case "medium":
        return { bg: PAPER_SUNKEN, border: PAPER_EDGE, text: INK_SOFT, label: "Medium" };
      case "low":
        return { bg: PAPER_SUNKEN, border: PAPER_EDGE, text: INK_FAINT, label: "Low" };
    }
  }

  // ── Section builders ──────────────────────────────────────────────────────

  function buildHeader(): string {
    return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
  <tr>
    <td style="padding:40px 32px 24px 32px;">
      ${tag(`SEO Report · ${escapeHtml(data.client.period_label)}`)}
      <h1 style="margin:0 0 6px 0;${FONT}font-size:30px;font-weight:700;color:${INK};line-height:1.15;letter-spacing:-0.015em;">${escapeHtml(data.client.name)}</h1>
      <p style="margin:0;${FONT}font-size:14px;color:${INK_SOFT};">${escapeHtml(data.client.domain)}</p>
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
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${INK};border-radius:12px;">
        <tr>
          <td style="padding:28px;">
            <p style="margin:0 0 12px 0;${MONO}font-size:11px;font-weight:600;color:${RUST_HOT};text-transform:uppercase;letter-spacing:0.22em;">Overall Score</p>
            <p style="margin:0;${FONT}font-size:60px;font-weight:700;color:${PAPER};line-height:1;letter-spacing:-0.025em;font-feature-settings:'tnum';">${escapeHtml(scoreDisplay)}<span style="font-size:20px;font-weight:500;color:${PAPER_EDGE};margin-left:6px;opacity:0.6;">/100</span></p>
            <p style="margin:14px 0 0 0;${FONT}font-size:13px;color:${PAPER_EDGE};">${escapeHtml(deltaLine)}</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
  }

  function buildScoreCard(label: string, score: number | null, delta: number | null): string {
    const d = formatScoreDelta(delta);
    return `
      <td style="width:50%;padding:6px;" valign="top">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${PAPER_RAISED};border:1px solid ${PAPER_EDGE};border-radius:10px;">
          <tr>
            <td style="padding:16px;">
              <p style="margin:0 0 6px 0;${MONO}font-size:10px;font-weight:600;color:${INK_SOFT};text-transform:uppercase;letter-spacing:0.18em;">${escapeHtml(label)}</p>
              <p style="margin:0 0 4px 0;${FONT}font-size:28px;font-weight:700;color:${INK};font-feature-settings:'tnum';letter-spacing:-0.02em;">${score != null ? score : "—"}</p>
              <p style="margin:0;${FONT}font-size:12px;color:${d.color};font-feature-settings:'tnum';">${d.arrow} ${escapeHtml(d.text)}</p>
            </td>
          </tr>
        </table>
      </td>`;
  }

  function buildScoreCards(): string {
    const h = data.health;
    return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
  <tr>
    <td style="padding:0 26px 24px 26px;">
      ${tag("01 · Site Health")}
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
          ${buildScoreCard("Technical", h.technical.current, h.technical.delta)}
          ${buildScoreCard("On-Page", h.onpage.current, h.onpage.delta)}
        </tr>
        <tr>
          ${buildScoreCard("Lighthouse Mobile", h.lighthouse_mobile.current, h.lighthouse_mobile.delta)}
          ${buildScoreCard("Lighthouse Desktop", h.lighthouse_desktop.current, h.lighthouse_desktop.delta)}
        </tr>
      </table>
    </td>
  </tr>
</table>`;
  }

  function buildOpenIssues(): string {
    const oi = data.health.open_issues;
    return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
  <tr>
    <td style="padding:0 32px 24px 32px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${PAPER_RAISED};border:1px solid ${PAPER_EDGE};border-radius:10px;">
        <tr>
          <td style="padding:18px 18px 8px 18px;">
            <p style="margin:0;${MONO}font-size:11px;font-weight:600;color:${INK_SOFT};text-transform:uppercase;letter-spacing:0.18em;">Open Issues · ${oi.total} tracked</p>
          </td>
        </tr>
        <tr>
          <td style="padding:0 18px 18px 18px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td style="width:25%;text-align:center;padding:6px 0;">
                  <p style="margin:0 0 2px 0;${FONT}font-size:22px;font-weight:700;color:${RUST_DEEP};font-feature-settings:'tnum';">${oi.critical}</p>
                  <p style="margin:0;${MONO}font-size:9px;font-weight:600;color:${INK_SOFT};text-transform:uppercase;letter-spacing:0.16em;">Critical</p>
                </td>
                <td style="width:25%;text-align:center;padding:6px 0;">
                  <p style="margin:0 0 2px 0;${FONT}font-size:22px;font-weight:700;color:${GOLD};font-feature-settings:'tnum';">${oi.high}</p>
                  <p style="margin:0;${MONO}font-size:9px;font-weight:600;color:${INK_SOFT};text-transform:uppercase;letter-spacing:0.16em;">High</p>
                </td>
                <td style="width:25%;text-align:center;padding:6px 0;">
                  <p style="margin:0 0 2px 0;${FONT}font-size:22px;font-weight:700;color:${INK_SOFT};font-feature-settings:'tnum';">${oi.medium}</p>
                  <p style="margin:0;${MONO}font-size:9px;font-weight:600;color:${INK_SOFT};text-transform:uppercase;letter-spacing:0.16em;">Medium</p>
                </td>
                <td style="width:25%;text-align:center;padding:6px 0;">
                  <p style="margin:0 0 2px 0;${FONT}font-size:22px;font-weight:700;color:${INK_FAINT};font-feature-settings:'tnum';">${oi.low}</p>
                  <p style="margin:0;${MONO}font-size:9px;font-weight:600;color:${INK_SOFT};text-transform:uppercase;letter-spacing:0.16em;">Low</p>
                </td>
              </tr>
            </table>
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
    const usersD = formatTrafficDelta(t.users.delta);
    const ppsD = formatTrafficDelta(t.pages_per_session.delta);

    const periodStart = new Date(t.period_start).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    const periodEnd = new Date(t.period_end).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });

    const src = t.sources;

    return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
  <tr>
    <td style="padding:0 32px 8px 32px;">
      ${tag("02 · Traffic")}
    </td>
  </tr>
  <tr>
    <td style="padding:0 32px 16px 32px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${PAPER_RAISED};border:1px solid ${PAPER_EDGE};border-radius:10px;margin-bottom:12px;">
        <tr>
          <td style="padding:18px;">
            <p style="margin:0 0 4px 0;${MONO}font-size:10px;font-weight:600;color:${INK_SOFT};text-transform:uppercase;letter-spacing:0.18em;">Sessions</p>
            <p style="margin:0 0 4px 0;${FONT}font-size:36px;font-weight:700;color:${INK};font-feature-settings:'tnum';letter-spacing:-0.025em;">${formatNumber(t.sessions.current)}</p>
            <p style="margin:0 0 2px 0;${FONT}font-size:12px;color:${sessD.color};font-feature-settings:'tnum';">${sessD.arrow} ${escapeHtml(sessD.text)}</p>
            <p style="margin:4px 0 0 0;${MONO}font-size:11px;color:${INK_FAINT};letter-spacing:0.04em;">${escapeHtml(periodStart)} – ${escapeHtml(periodEnd)}</p>
          </td>
        </tr>
      </table>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
          <td style="width:33.33%;padding-right:6px;" valign="top">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${PAPER_RAISED};border:1px solid ${PAPER_EDGE};border-radius:10px;">
              <tr>
                <td style="padding:14px;">
                  <p style="margin:0 0 4px 0;${MONO}font-size:10px;font-weight:600;color:${INK_SOFT};text-transform:uppercase;letter-spacing:0.18em;">Organic</p>
                  <p style="margin:0 0 2px 0;${FONT}font-size:22px;font-weight:700;color:${INK};font-feature-settings:'tnum';">${formatNumber(t.organic_sessions.current)}</p>
                  <p style="margin:0;${FONT}font-size:11px;color:${orgD.color};font-feature-settings:'tnum';">${orgD.arrow} ${escapeHtml(orgD.text)}</p>
                </td>
              </tr>
            </table>
          </td>
          <td style="width:33.33%;padding-right:6px;" valign="top">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${PAPER_RAISED};border:1px solid ${PAPER_EDGE};border-radius:10px;">
              <tr>
                <td style="padding:14px;">
                  <p style="margin:0 0 4px 0;${MONO}font-size:10px;font-weight:600;color:${INK_SOFT};text-transform:uppercase;letter-spacing:0.18em;">Users</p>
                  <p style="margin:0 0 2px 0;${FONT}font-size:22px;font-weight:700;color:${INK};font-feature-settings:'tnum';">${formatNumber(t.users.current)}</p>
                  <p style="margin:0;${FONT}font-size:11px;color:${usersD.color};font-feature-settings:'tnum';">${usersD.arrow} ${escapeHtml(usersD.text)}</p>
                </td>
              </tr>
            </table>
          </td>
          <td style="width:33.33%;" valign="top">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${PAPER_RAISED};border:1px solid ${PAPER_EDGE};border-radius:10px;">
              <tr>
                <td style="padding:14px;">
                  <p style="margin:0 0 4px 0;${MONO}font-size:10px;font-weight:600;color:${INK_SOFT};text-transform:uppercase;letter-spacing:0.18em;">Pages / Session</p>
                  <p style="margin:0 0 2px 0;${FONT}font-size:22px;font-weight:700;color:${INK};font-feature-settings:'tnum';">${formatDecimal(t.pages_per_session.current)}</p>
                  <p style="margin:0;${FONT}font-size:11px;color:${ppsD.color};font-feature-settings:'tnum';">${ppsD.arrow} ${escapeHtml(ppsD.text)}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="padding:0 32px 24px 32px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${PAPER_RAISED};border:1px solid ${PAPER_EDGE};border-radius:10px;">
        <tr>
          <td style="width:20%;padding:14px 8px;text-align:center;" valign="top">
            <p style="margin:0 0 3px 0;${FONT}font-size:16px;font-weight:700;color:${INK};font-feature-settings:'tnum';">${src.search}%</p>
            <p style="margin:0;${MONO}font-size:9px;font-weight:600;color:${INK_SOFT};text-transform:uppercase;letter-spacing:0.16em;">Search</p>
          </td>
          <td style="width:20%;padding:14px 8px;text-align:center;" valign="top">
            <p style="margin:0 0 3px 0;${FONT}font-size:16px;font-weight:700;color:${INK};font-feature-settings:'tnum';">${src.direct}%</p>
            <p style="margin:0;${MONO}font-size:9px;font-weight:600;color:${INK_SOFT};text-transform:uppercase;letter-spacing:0.16em;">Direct</p>
          </td>
          <td style="width:20%;padding:14px 8px;text-align:center;" valign="top">
            <p style="margin:0 0 3px 0;${FONT}font-size:16px;font-weight:700;color:${INK};font-feature-settings:'tnum';">${src.referral}%</p>
            <p style="margin:0;${MONO}font-size:9px;font-weight:600;color:${INK_SOFT};text-transform:uppercase;letter-spacing:0.16em;">Referral</p>
          </td>
          <td style="width:20%;padding:14px 8px;text-align:center;" valign="top">
            <p style="margin:0 0 3px 0;${FONT}font-size:16px;font-weight:700;color:${INK};font-feature-settings:'tnum';">${src.social}%</p>
            <p style="margin:0;${MONO}font-size:9px;font-weight:600;color:${INK_SOFT};text-transform:uppercase;letter-spacing:0.16em;">Social</p>
          </td>
          <td style="width:20%;padding:14px 8px;text-align:center;" valign="top">
            <p style="margin:0 0 3px 0;${FONT}font-size:16px;font-weight:700;color:${INK};font-feature-settings:'tnum';">${src.other}%</p>
            <p style="margin:0;${MONO}font-size:9px;font-weight:600;color:${INK_SOFT};text-transform:uppercase;letter-spacing:0.16em;">Other</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
  }

  function buildTopPages(): string {
    if (data.top_pages.length === 0) return "";

    const rows = data.top_pages
      .map(
        (p) => `
      <tr>
        <td style="padding:10px 0;border-top:1px solid ${PAPER_EDGE};${FONT}font-size:13px;color:${INK};width:60%;word-break:break-all;">${escapeHtml(p.path)}</td>
        <td style="padding:10px 8px;border-top:1px solid ${PAPER_EDGE};${FONT}font-size:13px;color:${INK};font-feature-settings:'tnum';white-space:nowrap;text-align:right;">${formatNumber(p.sessions)}</td>
        <td style="padding:10px 0;border-top:1px solid ${PAPER_EDGE};${FONT}font-size:13px;color:${INK_SOFT};font-feature-settings:'tnum';white-space:nowrap;text-align:right;">${p.pct_of_total}%</td>
      </tr>`,
      )
      .join("");

    return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
  <tr>
    <td style="padding:0 32px 24px 32px;">
      ${tag("03 · Top Pages")}
      <table cellpadding="0" cellspacing="0" border="0" width="100%">
        <thead>
          <tr>
            <th style="padding:0 0 8px 0;text-align:left;${MONO}font-size:10px;font-weight:600;color:${INK_SOFT};text-transform:uppercase;letter-spacing:0.18em;">Page</th>
            <th style="padding:0 8px 8px 8px;text-align:right;${MONO}font-size:10px;font-weight:600;color:${INK_SOFT};text-transform:uppercase;letter-spacing:0.18em;">Sessions</th>
            <th style="padding:0 0 8px 0;text-align:right;${MONO}font-size:10px;font-weight:600;color:${INK_SOFT};text-transform:uppercase;letter-spacing:0.18em;">% Total</th>
          </tr>
        </thead>
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
      ${tag("04 · Keyword Rankings")}
      <p style="margin:0;${FONT}font-size:14px;color:${INK_SOFT};">${kw.ranking_count} of ${kw.tracked_count} phrases ranking (${pct}%). No notable movers this period.</p>
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
          <td style="padding:8px 0;border-top:1px solid ${PAPER_EDGE};">
            <p style="margin:0 0 2px 0;${FONT}font-size:13px;color:${INK};">${escapeHtml(m.keyword)}</p>
            <p style="margin:0;${MONO}font-size:11px;color:${INK_SOFT};letter-spacing:0.04em;">${prior} → ${cur} <span style="color:${SAGE};">${d.arrow} ${escapeHtml(d.text)}</span></p>
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
          <td style="padding:8px 0;border-top:1px solid ${PAPER_EDGE};">
            <p style="margin:0 0 2px 0;${FONT}font-size:13px;color:${INK};">${escapeHtml(m.keyword)}</p>
            <p style="margin:0;${MONO}font-size:11px;color:${INK_SOFT};letter-spacing:0.04em;">${prior} → ${cur} <span style="color:${RUST_DEEP};">${d.arrow} ${escapeHtml(d.text)}</span></p>
          </td>
        </tr>`;
      })
      .join("");

    return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
  <tr>
    <td style="padding:0 32px 6px 32px;">
      ${tag("04 · Keyword Rankings")}
      <p style="margin:0 0 16px 0;${FONT}font-size:13px;color:${INK_SOFT};">${kw.ranking_count} of ${kw.tracked_count} phrases ranking (${pct}%).</p>
    </td>
  </tr>
  <tr>
    <td style="padding:0 32px 24px 32px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
          ${hasUp ? `<td style="width:${hasDown ? "50%" : "100%"};vertical-align:top;${hasDown ? "padding-right:12px;" : ""}">
            <p style="margin:0 0 6px 0;${MONO}font-size:10px;font-weight:600;color:${SAGE};text-transform:uppercase;letter-spacing:0.18em;">Climbers</p>
            <table cellpadding="0" cellspacing="0" border="0" width="100%">${upRows}</table>
          </td>` : ""}
          ${hasDown ? `<td style="width:${hasUp ? "50%" : "100%"};vertical-align:top;${hasUp ? "padding-left:12px;" : ""}">
            <p style="margin:0 0 6px 0;${MONO}font-size:10px;font-weight:600;color:${RUST_DEEP};text-transform:uppercase;letter-spacing:0.18em;">Slippage</p>
            <table cellpadding="0" cellspacing="0" border="0" width="100%">${downRows}</table>
          </td>` : ""}
        </tr>
      </table>
    </td>
  </tr>
</table>`;
  }

  function buildWhatNeedsAttention(): string {
    if (data.issues.open_top.length === 0) return "";

    const rows = data.issues.open_top
      .map((issue) => {
        const s = severityStyle(issue.severity);
        const pill = `<span style="display:inline-block;padding:2px 8px;border-radius:4px;background:${s.bg};border:1px solid ${s.border};${MONO}font-size:10px;font-weight:600;color:${s.text};text-transform:uppercase;letter-spacing:0.12em;">${s.label}</span>`;
        return `
      <tr>
        <td style="padding:12px 0;border-top:1px solid ${PAPER_EDGE};">
          ${pill}
          <p style="margin:6px 0 2px 0;${FONT}font-size:14px;font-weight:600;color:${INK};">${escapeHtml(issue.title)}</p>
          ${issue.page_url ? `<p style="margin:0;${MONO}font-size:11px;color:${INK_FAINT};letter-spacing:0.04em;word-break:break-all;">${escapeHtml(issue.page_url)}</p>` : ""}
        </td>
      </tr>`;
      })
      .join("");

    return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
  <tr>
    <td style="padding:0 32px 24px 32px;">
      ${tag("05 · What needs attention")}
      <table cellpadding="0" cellspacing="0" border="0" width="100%">
        ${rows}
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
        <td style="padding:8px 0;border-top:1px solid ${PAPER_EDGE};">
          <p style="margin:0;${FONT}font-size:13px;color:${INK};"><span style="color:${SAGE};font-weight:700;">✓</span> ${escapeHtml(r.title)}</p>
        </td>
      </tr>`,
      )
      .join("");

    return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
  <tr>
    <td style="padding:0 32px 24px 32px;">
      ${tag("06 · Resolved this period", SAGE)}
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
          <td style="padding:10px 0;border-top:1px solid ${PAPER_EDGE};${FONT}font-size:13px;color:${INK};width:60%;word-break:break-word;">${escapeHtml(c.name)}</td>
          <td style="padding:10px 8px;border-top:1px solid ${PAPER_EDGE};${FONT}font-size:13px;color:${INK};font-feature-settings:'tnum';white-space:nowrap;text-align:right;">${fmtUsd(c.cost)}</td>
          <td style="padding:10px 0;border-top:1px solid ${PAPER_EDGE};${FONT}font-size:13px;color:${INK_SOFT};font-feature-settings:'tnum';white-space:nowrap;text-align:right;">${formatNumber(c.clicks)}</td>
        </tr>`,
        )
        .join("");

      return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
  <tr>
    <td style="padding:0 32px 8px 32px;">
      ${tag("07 · Google Ads")}
    </td>
  </tr>
  <tr>
    <td style="padding:0 32px 16px 32px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${PAPER_RAISED};border:1px solid ${PAPER_EDGE};border-radius:10px;margin-bottom:12px;">
        <tr>
          <td style="padding:18px;">
            <p style="margin:0 0 4px 0;${MONO}font-size:10px;font-weight:600;color:${INK_SOFT};text-transform:uppercase;letter-spacing:0.18em;">Spend</p>
            <p style="margin:0 0 4px 0;${FONT}font-size:36px;font-weight:700;color:${INK};font-feature-settings:'tnum';letter-spacing:-0.025em;">${fmtUsd(m.cost)}</p>
            <p style="margin:0;${MONO}font-size:11px;color:${INK_FAINT};letter-spacing:0.04em;">${escapeHtml(m.period_start)} – ${escapeHtml(m.period_end)}</p>
          </td>
        </tr>
      </table>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
          <td style="width:33.33%;padding-right:6px;" valign="top">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${PAPER_RAISED};border:1px solid ${PAPER_EDGE};border-radius:10px;">
              <tr>
                <td style="padding:14px;">
                  <p style="margin:0 0 4px 0;${MONO}font-size:10px;font-weight:600;color:${INK_SOFT};text-transform:uppercase;letter-spacing:0.18em;">Clicks</p>
                  <p style="margin:0;${FONT}font-size:22px;font-weight:700;color:${INK};font-feature-settings:'tnum';">${formatNumber(m.clicks)}</p>
                </td>
              </tr>
            </table>
          </td>
          <td style="width:33.33%;padding-right:6px;" valign="top">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${PAPER_RAISED};border:1px solid ${PAPER_EDGE};border-radius:10px;">
              <tr>
                <td style="padding:14px;">
                  <p style="margin:0 0 4px 0;${MONO}font-size:10px;font-weight:600;color:${INK_SOFT};text-transform:uppercase;letter-spacing:0.18em;">Impressions</p>
                  <p style="margin:0;${FONT}font-size:22px;font-weight:700;color:${INK};font-feature-settings:'tnum';">${formatNumber(m.impressions)}</p>
                </td>
              </tr>
            </table>
          </td>
          <td style="width:33.33%;" valign="top">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${PAPER_RAISED};border:1px solid ${PAPER_EDGE};border-radius:10px;">
              <tr>
                <td style="padding:14px;">
                  <p style="margin:0 0 4px 0;${MONO}font-size:10px;font-weight:600;color:${INK_SOFT};text-transform:uppercase;letter-spacing:0.18em;">CTR</p>
                  <p style="margin:0;${FONT}font-size:22px;font-weight:700;color:${INK};font-feature-settings:'tnum';">${fmtPct(m.ctr)}</p>
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
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${PAPER_RAISED};border:1px solid ${PAPER_EDGE};border-radius:10px;">
              <tr>
                <td style="padding:14px;">
                  <p style="margin:0 0 4px 0;${MONO}font-size:10px;font-weight:600;color:${INK_SOFT};text-transform:uppercase;letter-spacing:0.18em;">Conversions</p>
                  <p style="margin:0;${FONT}font-size:22px;font-weight:700;color:${INK};font-feature-settings:'tnum';">${m.conversions.toFixed(1)}</p>
                </td>
              </tr>
            </table>
          </td>
          <td style="width:50%;" valign="top">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${PAPER_RAISED};border:1px solid ${PAPER_EDGE};border-radius:10px;">
              <tr>
                <td style="padding:14px;">
                  <p style="margin:0 0 4px 0;${MONO}font-size:10px;font-weight:600;color:${INK_SOFT};text-transform:uppercase;letter-spacing:0.18em;">${m.cost_per_conversion != null ? "Cost / Conversion" : "Avg CPC"}</p>
                  <p style="margin:0;${FONT}font-size:22px;font-weight:700;color:${INK};font-feature-settings:'tnum';">${m.cost_per_conversion != null ? fmtUsd(m.cost_per_conversion) : fmtCpc(m.avg_cpc)}</p>
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
      <p style="margin:0 0 10px 0;${MONO}font-size:10px;font-weight:600;color:${INK_SOFT};text-transform:uppercase;letter-spacing:0.18em;">Top Campaigns</p>
      <table cellpadding="0" cellspacing="0" border="0" width="100%">
        <thead>
          <tr>
            <th style="padding:0 0 6px 0;text-align:left;${MONO}font-size:10px;font-weight:600;color:${INK_SOFT};text-transform:uppercase;letter-spacing:0.18em;">Campaign</th>
            <th style="padding:0 8px 6px 8px;text-align:right;${MONO}font-size:10px;font-weight:600;color:${INK_SOFT};text-transform:uppercase;letter-spacing:0.18em;">Spend</th>
            <th style="padding:0 0 6px 0;text-align:right;${MONO}font-size:10px;font-weight:600;color:${INK_SOFT};text-transform:uppercase;letter-spacing:0.18em;">Clicks</th>
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
      ${tag("07 · Google Ads")}
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${PAPER_RAISED};border:1px dashed ${PAPER_EDGE};border-radius:12px;">
        <tr>
          <td style="padding:22px 26px;">
            <p style="margin:0 0 6px 0;${FONT}font-size:16px;font-weight:700;color:${INK};letter-spacing:-0.01em;">Link your Google Ads.</p>
            <p style="margin:0;${FONT}font-size:14px;color:${INK_SOFT};line-height:1.6;">If you run Google Ads campaigns and want the performance included here each month, add Niewdel as a manager on your Google Ads account. We don't run the campaigns, we just pull the data for your monthly report. Reply if you'd like to set it up.</p>
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
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${PAPER_RAISED};border:1px solid ${PAPER_EDGE};border-radius:12px;">
        <tr>
          <td style="padding:22px 26px;">
            ${tag("In plain English", INK_SOFT)}
            <p style="margin:0;${FONT}font-size:14px;color:${INK};line-height:1.65;">${escapeHtml(data.ai_summary).replace(/\n\n+/g, `</p><p style="margin:12px 0 0 0;${FONT}font-size:14px;color:${INK};line-height:1.65;">`).replace(/\n/g, "<br/>")}</p>
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
    <td style="padding:24px 32px 32px 32px;border-top:1px solid ${PAPER_EDGE};">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
          <td style="vertical-align:middle;">
            <p style="margin:0;${FONT}font-size:15px;font-weight:700;color:${INK};letter-spacing:-0.01em;">niewdel</p>
          </td>
          <td style="text-align:right;vertical-align:middle;">
            <p style="margin:0;${MONO}font-size:11px;color:${INK_SOFT};letter-spacing:0.04em;">${escapeHtml(generatedDate)}</p>
          </td>
        </tr>
      </table>
      <p style="margin:14px 0 0 0;${FONT}font-size:12px;color:${INK_FAINT};line-height:1.5;">Questions? Just reply to this email.</p>
    </td>
  </tr>
</table>`;
  }

  // ── Assemble ──────────────────────────────────────────────────────────────

  const body = [
    opts.intro ?? "",
    buildHeader(),
    buildOverallScoreHero(),
    buildScoreCards(),
    buildOpenIssues(),
    buildTrafficSection(),
    buildTopPages(),
    buildKeywordRankings(),
    buildWhatNeedsAttention(),
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
<meta http-equiv="X-UA-Compatible" content="IE=edge"/>
<title>SEO Report: ${escapeHtml(data.client.name)}</title>
</head>
<body style="margin:0;padding:0;background:${PAPER};${FONT}">
<!--[if mso]><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td><![endif]-->
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${PAPER};">
  <tr>
    <td style="padding:32px 0;" align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;background:${PAPER};border:1px solid ${PAPER_EDGE};border-radius:14px;overflow:hidden;">
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
