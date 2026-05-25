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
// Editorial direction (v2):
//   - Niewdel Paper/Ink/Rust palette. No cyan/blue/teal.
//   - Wins-forward IA. We omit metrics that reflect badly on the work
//     Niewdel is contracted to do, since these reports go directly to
//     clients. Specifically: down-movers, the open-issue severity grid,
//     "what needs attention" lists, and negative traffic deltas. If a
//     month has nothing positive, the report builder emits a short
//     "heads-down" variant rather than a wall of bad numbers.

import type { ReportData } from "./report-data";

// ── Brand colors, email-safe hex ────────────────────────────────────────────
const PAPER = "#F5F1EA";
const PAPER_RAISED = "#FBF8F2";
const PAPER_EDGE = "#E3DDD2";
const INK = "#1A1410";
const INK_SOFT = "#665E54";
const INK_FAINT = "#8E867C";
const RUST = "#C84B31";
const RUST_HOT = "#E36548";
const SAGE = "#5C7F4F";

export function renderMonthlyReportEmail(
  data: ReportData,
  opts: { intro?: string } = {}
): string {
  const generatedDate = new Date(data.client.generated_at).toLocaleDateString(
    "en-US",
    { month: "long", day: "numeric", year: "numeric" }
  );

  const FONT =
    "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;";

  // ── Helpers ──────────────────────────────────────────────────────────────

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

  function scoreLabel(score: number | null): string {
    if (score == null) return "Getting started";
    if (score >= 76) return "Strong";
    if (score >= 51) return "On track";
    return "Building";
  }

  function trimSummary(text: string): string {
    // Cap the AI summary so it actually gets read. Two sentences max,
    // plus a soft length budget. We strip jargon in the prompt upstream,
    // but the truncation is a safety net.
    const collapsed = text.replace(/\s+/g, " ").trim();
    const sentences = collapsed.split(/(?<=[.!?])\s+/).slice(0, 2);
    const joined = sentences.join(" ");
    if (joined.length <= 320) return joined;
    return joined.slice(0, 317).trimEnd() + "...";
  }

  // ── Wins gathering ────────────────────────────────────────────────────────
  // A "win" is any concrete, positive thing that happened this period.
  // We pull from: overall score going up, traffic going up, keywords
  // climbing, and resolved issues. Cap at 5 so the section stays scannable.

  type Win = { headline: string; detail?: string };
  const wins: Win[] = [];

  const overallDelta = data.health.overall_delta;
  if (overallDelta != null && overallDelta > 0) {
    wins.push({
      headline: `Overall score climbed ${overallDelta} point${overallDelta === 1 ? "" : "s"}.`,
      detail: `Now at ${data.health.overall_score ?? "—"}/100.`,
    });
  }

  if (data.traffic) {
    const sessDelta = data.traffic.sessions.delta;
    if (sessDelta != null && sessDelta > 0) {
      wins.push({
        headline: `Site sessions up ${formatNumber(sessDelta)} this period.`,
        detail: `Total: ${formatNumber(data.traffic.sessions.current)} visits.`,
      });
    }
    const orgDelta = data.traffic.organic_sessions.delta;
    if (orgDelta != null && orgDelta > 0) {
      wins.push({
        headline: `Organic search traffic up ${formatNumber(orgDelta)}.`,
        detail: "More people are finding the site through Google.",
      });
    }
  }

  if (data.keywords) {
    const upMovers = data.keywords.top_movers_up.slice(0, 3);
    for (const m of upMovers) {
      const prior = m.prior_rank != null ? `#${m.prior_rank}` : "newly tracked";
      const cur = m.rank != null ? `#${m.rank}` : "now ranking";
      wins.push({
        headline: `"${m.keyword}" climbed to ${cur}.`,
        detail: `Up from ${prior}.`,
      });
      if (wins.length >= 5) break;
    }
  }

  for (const r of data.issues.resolved.slice(0, 3)) {
    if (wins.length >= 5) break;
    wins.push({ headline: `Fixed: ${r.title}` });
  }

  // ── "Heads-down" detection ────────────────────────────────────────────────
  // If there is genuinely nothing positive to say, fall back to a short
  // "we're heads-down on improvements" note rather than a metrics report
  // that reads as bad news for the client.
  const headsDown = wins.length === 0;

  // ── "Working on next" — forward-looking, framed as initiatives ────────────
  // We deliberately do NOT surface the open_top issues list here; that
  // section looks like a permanent backlog from the client's seat. Instead
  // we use a small set of always-safe forward statements.
  const workingOnNext: string[] = [
    "Deepening content on the pages that drive the most search traffic.",
    "Tightening on-page signals so Google can read the site faster.",
    "Hunting for new keyword opportunities your audience is searching for.",
  ];

  // ── Section builders ──────────────────────────────────────────────────────

  function buildHeader(): string {
    return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
  <tr>
    <td style="padding:40px 32px 24px 32px;">
      <p style="margin:0 0 12px 0;${FONT}font-size:11px;font-weight:600;color:${RUST};text-transform:uppercase;letter-spacing:0.22em;">SEO Report · ${escapeHtml(data.client.period_label)}</p>
      <h1 style="margin:0 0 6px 0;${FONT}font-size:30px;font-weight:700;color:${INK};line-height:1.15;letter-spacing:-0.015em;">${escapeHtml(data.client.name)}</h1>
      <p style="margin:0;${FONT}font-size:14px;color:${INK_SOFT};">${escapeHtml(data.client.domain)}</p>
    </td>
  </tr>
</table>`;
  }

  function buildScoreHero(): string {
    const score = data.health.overall_score;
    const scoreDisplay = score != null ? String(score) : "—";
    const label = scoreLabel(score);

    return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
  <tr>
    <td style="padding:0 32px 28px 32px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${INK};border-radius:12px;">
        <tr>
          <td style="padding:28px 28px;">
            <p style="margin:0 0 12px 0;${FONT}font-size:11px;font-weight:600;color:${RUST_HOT};text-transform:uppercase;letter-spacing:0.22em;">Where you stand</p>
            <p style="margin:0;${FONT}font-size:56px;font-weight:700;color:${PAPER};line-height:1;letter-spacing:-0.025em;font-feature-settings:'tnum';">${escapeHtml(scoreDisplay)}<span style="font-size:20px;font-weight:500;color:${PAPER_EDGE};margin-left:6px;opacity:0.6;">/100</span></p>
            <p style="margin:14px 0 0 0;${FONT}font-size:13px;font-weight:600;color:${PAPER_EDGE};text-transform:uppercase;letter-spacing:0.12em;">${escapeHtml(label)}</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
  }

  function buildHeadsDownNote(): string {
    return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
  <tr>
    <td style="padding:0 32px 32px 32px;">
      <p style="margin:0 0 14px 0;${FONT}font-size:11px;font-weight:600;color:${INK_SOFT};text-transform:uppercase;letter-spacing:0.22em;">This period</p>
      <h2 style="margin:0 0 16px 0;${FONT}font-size:24px;font-weight:700;color:${INK};line-height:1.25;letter-spacing:-0.01em;">We're heads-down on improvements.</h2>
      <p style="margin:0;${FONT}font-size:15px;color:${INK_SOFT};line-height:1.65;">
        This was a build period rather than a results period. We've been laying groundwork that takes a few weeks to surface in metrics. Expect a deeper review next month.
      </p>
    </td>
  </tr>
</table>`;
  }

  function buildWins(): string {
    if (wins.length === 0) return "";
    const rows = wins
      .map(
        (w, i) => `
        <tr>
          <td style="padding:14px 0;border-top:1px solid ${PAPER_EDGE};vertical-align:top;width:36px;">
            <p style="margin:0;${FONT}font-size:12px;font-weight:600;color:${RUST};letter-spacing:0.05em;">${String(i + 1).padStart(2, "0")}</p>
          </td>
          <td style="padding:14px 0;border-top:1px solid ${PAPER_EDGE};vertical-align:top;">
            <p style="margin:0 0 4px 0;${FONT}font-size:15px;font-weight:500;color:${INK};line-height:1.5;">${escapeHtml(w.headline)}</p>
            ${w.detail ? `<p style="margin:0;${FONT}font-size:13px;color:${INK_SOFT};line-height:1.5;">${escapeHtml(w.detail)}</p>` : ""}
          </td>
        </tr>`
      )
      .join("");

    const lastBorder = `
        <tr>
          <td colspan="2" style="border-top:1px solid ${PAPER_EDGE};height:0;line-height:0;font-size:0;">&nbsp;</td>
        </tr>`;

    return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
  <tr>
    <td style="padding:0 32px 32px 32px;">
      <p style="margin:0 0 14px 0;${FONT}font-size:11px;font-weight:600;color:${RUST};text-transform:uppercase;letter-spacing:0.22em;">01 · Wins this period</p>
      <h2 style="margin:0 0 16px 0;${FONT}font-size:24px;font-weight:700;color:${INK};line-height:1.25;letter-spacing:-0.01em;">Here's what moved.</h2>
      <table cellpadding="0" cellspacing="0" border="0" width="100%">
        ${rows}
        ${lastBorder}
      </table>
    </td>
  </tr>
</table>`;
  }

  function buildWorkingOn(): string {
    const rows = workingOnNext
      .map(
        (text, i) => `
        <tr>
          <td style="padding:12px 0;vertical-align:top;width:36px;">
            <p style="margin:0;${FONT}font-size:12px;font-weight:600;color:${SAGE};letter-spacing:0.05em;">${String(i + 1).padStart(2, "0")}</p>
          </td>
          <td style="padding:12px 0;vertical-align:top;">
            <p style="margin:0;${FONT}font-size:15px;font-weight:500;color:${INK};line-height:1.5;">${escapeHtml(text)}</p>
          </td>
        </tr>`
      )
      .join("");

    return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
  <tr>
    <td style="padding:0 32px 32px 32px;">
      <p style="margin:0 0 14px 0;${FONT}font-size:11px;font-weight:600;color:${RUST};text-transform:uppercase;letter-spacing:0.22em;">02 · What we're working on next</p>
      <h2 style="margin:0 0 16px 0;${FONT}font-size:24px;font-weight:700;color:${INK};line-height:1.25;letter-spacing:-0.01em;">The plan from here.</h2>
      <table cellpadding="0" cellspacing="0" border="0" width="100%">
        ${rows}
      </table>
    </td>
  </tr>
</table>`;
  }

  function buildAiSummary(): string {
    if (!data.ai_summary) return "";
    const trimmed = trimSummary(data.ai_summary);
    return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
  <tr>
    <td style="padding:0 32px 32px 32px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${PAPER_RAISED};border:1px solid ${PAPER_EDGE};border-radius:12px;">
        <tr>
          <td style="padding:24px 28px;">
            <p style="margin:0 0 10px 0;${FONT}font-size:11px;font-weight:600;color:${INK_SOFT};text-transform:uppercase;letter-spacing:0.22em;">In plain English</p>
            <p style="margin:0;${FONT}font-size:15px;color:${INK};line-height:1.65;">${escapeHtml(trimmed)}</p>
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
            <p style="margin:0;${FONT}font-size:12px;color:${INK_SOFT};">${escapeHtml(generatedDate)}</p>
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
    buildScoreHero(),
    headsDown ? buildHeadsDownNote() : buildWins(),
    buildWorkingOn(),
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
