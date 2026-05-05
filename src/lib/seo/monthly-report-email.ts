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

import type { ReportData, SeoIssueRowOut } from "./report-data";

export function renderMonthlyReportEmail(
  data: ReportData,
  opts: { baseUrl: string }
): string {
  const { baseUrl } = opts;
  const dashboardUrl = `${baseUrl}/seo/clients/${data.client.id}/report?range=30d`;

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

  function formatDecimal(n: number, places = 2): string {
    return n.toFixed(places);
  }

  interface DeltaDisplay {
    glyph: string;
    color: string;
    text: string;
  }

  // For scores: positive delta = improvement (green ↑), negative = worse (red ↓)
  function formatScoreDelta(delta: number | null): DeltaDisplay {
    if (delta == null) return { glyph: "—", color: "#64748b", text: "no prior data" };
    if (delta > 0) return { glyph: "↑", color: "#059669", text: `+${delta}` };
    if (delta < 0) return { glyph: "↓", color: "#dc2626", text: `${delta}` };
    return { glyph: "—", color: "#64748b", text: "no change" };
  }

  // For traffic: positive delta = more sessions (good, green ↑)
  function formatTrafficDelta(delta: number | null): DeltaDisplay {
    if (delta == null) return { glyph: "—", color: "#64748b", text: "no prior data" };
    if (delta > 0) return { glyph: "↑", color: "#059669", text: `+${formatNumber(delta)}` };
    if (delta < 0) return { glyph: "↓", color: "#dc2626", text: formatNumber(delta) };
    return { glyph: "—", color: "#64748b", text: "no change" };
  }

  // For keywords: negative delta = rank improved (green), positive = worse (red)
  function formatRankDelta(delta: number | null): DeltaDisplay {
    if (delta == null) return { glyph: "—", color: "#64748b", text: "no prior data" };
    if (delta < 0) return { glyph: "↑", color: "#059669", text: `↑ ${Math.abs(delta)}` };
    if (delta > 0) return { glyph: "↓", color: "#dc2626", text: `↓ ${delta}` };
    return { glyph: "—", color: "#64748b", text: "no change" };
  }

  interface SeverityStyle {
    bg: string;
    border: string;
    text: string;
    label: string;
  }

  function severityStyle(severity: SeoIssueRowOut["severity"]): SeverityStyle {
    switch (severity) {
      case "critical":
        return { bg: "#fef2f2", border: "#fca5a5", text: "#dc2626", label: "Critical" };
      case "high":
        return { bg: "#fffbeb", border: "#fcd34d", text: "#d97706", label: "High" };
      case "medium":
        return { bg: "#f8fafc", border: "#cbd5e1", text: "#475569", label: "Medium" };
      case "low":
        return { bg: "#f8fafc", border: "#e2e8f0", text: "#94a3b8", label: "Low" };
    }
  }

  // ── Section builders ──────────────────────────────────────────────────────

  function buildHeader(): string {
    return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
  <tr>
    <td style="padding:32px 32px 24px 32px;">
      <p style="margin:0 0 8px 0;${FONT}font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">${escapeHtml("SEO Report")} &mdash; ${escapeHtml(data.client.period_label)}</p>
      <h1 style="margin:0 0 6px 0;${FONT}font-size:28px;font-weight:700;color:#0f172a;line-height:1.2;">${escapeHtml(data.client.name)}</h1>
      <p style="margin:0;${FONT}font-size:14px;color:#64748b;">${escapeHtml(data.client.domain)}</p>
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
        ? `${delta > 0 ? "+" : ""}${delta} vs start of period`
        : "No prior data in window.";

    return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
  <tr>
    <td style="padding:0 32px 24px 32px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#0f172a;border-radius:8px;">
        <tr>
          <td style="padding:24px;">
            <p style="margin:0 0 8px 0;${FONT}font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">Overall Score</p>
            <p style="margin:0;${FONT}font-size:60px;font-weight:700;color:#06b6d4;line-height:1;font-feature-settings:'tnum';">${escapeHtml(scoreDisplay)}</p>
            <p style="margin:8px 0 0 0;${FONT}font-size:13px;color:#94a3b8;">${escapeHtml(deltaLine)}</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
  }

  function buildScoreCard(
    label: string,
    score: number | null,
    delta: number | null
  ): string {
    const d = formatScoreDelta(delta);
    return `
      <td style="width:50%;padding:8px;" valign="top">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
          <tr>
            <td style="padding:16px;">
              <p style="margin:0 0 6px 0;${FONT}font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">${escapeHtml(label)}</p>
              <p style="margin:0 0 4px 0;${FONT}font-size:28px;font-weight:700;color:#06b6d4;font-feature-settings:'tnum';">${score != null ? score : "—"}</p>
              <p style="margin:0;${FONT}font-size:12px;color:${d.color};">${escapeHtml(d.glyph)} ${escapeHtml(d.text)}</p>
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
    <td style="padding:0 24px 24px 24px;">
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
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
        <tr>
          <td style="padding:16px 16px 12px 16px;">
            <p style="margin:0 0 12px 0;${FONT}font-size:14px;font-weight:700;color:#0f172a;">Open Issues <span style="font-size:13px;color:#64748b;font-weight:400;">(${oi.total} total)</span></p>
          </td>
        </tr>
        <tr>
          <td style="padding:0 16px 16px 16px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td style="width:25%;text-align:center;">
                  <p style="margin:0 0 2px 0;${FONT}font-size:22px;font-weight:700;color:#dc2626;">${oi.critical}</p>
                  <p style="margin:0;${FONT}font-size:10px;font-weight:600;color:#dc2626;text-transform:uppercase;">Critical</p>
                </td>
                <td style="width:25%;text-align:center;">
                  <p style="margin:0 0 2px 0;${FONT}font-size:22px;font-weight:700;color:#f59e0b;">${oi.high}</p>
                  <p style="margin:0;${FONT}font-size:10px;font-weight:600;color:#f59e0b;text-transform:uppercase;">High</p>
                </td>
                <td style="width:25%;text-align:center;">
                  <p style="margin:0 0 2px 0;${FONT}font-size:22px;font-weight:700;color:#475569;">${oi.medium}</p>
                  <p style="margin:0;${FONT}font-size:10px;font-weight:600;color:#475569;text-transform:uppercase;">Medium</p>
                </td>
                <td style="width:25%;text-align:center;">
                  <p style="margin:0 0 2px 0;${FONT}font-size:22px;font-weight:700;color:#94a3b8;">${oi.low}</p>
                  <p style="margin:0;${FONT}font-size:10px;font-weight:600;color:#94a3b8;text-transform:uppercase;">Low</p>
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
      <p style="margin:0;${FONT}font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">Site Traffic</p>
    </td>
  </tr>
  <tr>
    <td style="padding:0 32px 16px 32px;">
      <!-- Sessions hero -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:12px;">
        <tr>
          <td style="padding:16px;">
            <p style="margin:0 0 4px 0;${FONT}font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;">Sessions</p>
            <p style="margin:0 0 4px 0;${FONT}font-size:32px;font-weight:700;color:#06b6d4;font-feature-settings:'tnum';">${formatNumber(t.sessions.current)}</p>
            <p style="margin:0 0 2px 0;${FONT}font-size:12px;color:${sessD.color};">${escapeHtml(sessD.glyph)} ${escapeHtml(sessD.text)}</p>
            <p style="margin:4px 0 0 0;${FONT}font-size:11px;color:#94a3b8;">${escapeHtml(periodStart)} &ndash; ${escapeHtml(periodEnd)}</p>
          </td>
        </tr>
      </table>
      <!-- 3 small cards -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
          <td style="width:33.33%;padding-right:6px;" valign="top">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
              <tr>
                <td style="padding:12px;">
                  <p style="margin:0 0 4px 0;${FONT}font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase;">Organic Sessions</p>
                  <p style="margin:0 0 2px 0;${FONT}font-size:20px;font-weight:700;color:#06b6d4;font-feature-settings:'tnum';">${formatNumber(t.organic_sessions.current)}</p>
                  <p style="margin:0;${FONT}font-size:11px;color:${orgD.color};">${escapeHtml(orgD.glyph)} ${escapeHtml(orgD.text)}</p>
                </td>
              </tr>
            </table>
          </td>
          <td style="width:33.33%;padding-right:6px;" valign="top">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
              <tr>
                <td style="padding:12px;">
                  <p style="margin:0 0 4px 0;${FONT}font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase;">Users</p>
                  <p style="margin:0 0 2px 0;${FONT}font-size:20px;font-weight:700;color:#06b6d4;font-feature-settings:'tnum';">${formatNumber(t.users.current)}</p>
                  <p style="margin:0;${FONT}font-size:11px;color:${usersD.color};">${escapeHtml(usersD.glyph)} ${escapeHtml(usersD.text)}</p>
                </td>
              </tr>
            </table>
          </td>
          <td style="width:33.33%;" valign="top">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
              <tr>
                <td style="padding:12px;">
                  <p style="margin:0 0 4px 0;${FONT}font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase;">Pages / Session</p>
                  <p style="margin:0 0 2px 0;${FONT}font-size:20px;font-weight:700;color:#06b6d4;font-feature-settings:'tnum';">${formatDecimal(t.pages_per_session.current)}</p>
                  <p style="margin:0;${FONT}font-size:11px;color:${ppsD.color};">${escapeHtml(ppsD.glyph)} ${escapeHtml(ppsD.text)}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <!-- Traffic sources strip -->
  <tr>
    <td style="padding:0 32px 24px 32px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
        <tr>
          <td style="width:20%;padding:12px 8px;text-align:center;" valign="top">
            <p style="margin:0 0 3px 0;${FONT}font-size:16px;font-weight:700;color:#06b6d4;font-feature-settings:'tnum';">${src.search}%</p>
            <p style="margin:0;${FONT}font-size:10px;color:#64748b;font-weight:600;text-transform:uppercase;">Search</p>
          </td>
          <td style="width:20%;padding:12px 8px;text-align:center;" valign="top">
            <p style="margin:0 0 3px 0;${FONT}font-size:16px;font-weight:700;color:#06b6d4;font-feature-settings:'tnum';">${src.direct}%</p>
            <p style="margin:0;${FONT}font-size:10px;color:#64748b;font-weight:600;text-transform:uppercase;">Direct</p>
          </td>
          <td style="width:20%;padding:12px 8px;text-align:center;" valign="top">
            <p style="margin:0 0 3px 0;${FONT}font-size:16px;font-weight:700;color:#06b6d4;font-feature-settings:'tnum';">${src.referral}%</p>
            <p style="margin:0;${FONT}font-size:10px;color:#64748b;font-weight:600;text-transform:uppercase;">Referral</p>
          </td>
          <td style="width:20%;padding:12px 8px;text-align:center;" valign="top">
            <p style="margin:0 0 3px 0;${FONT}font-size:16px;font-weight:700;color:#06b6d4;font-feature-settings:'tnum';">${src.social}%</p>
            <p style="margin:0;${FONT}font-size:10px;color:#64748b;font-weight:600;text-transform:uppercase;">Social</p>
          </td>
          <td style="width:20%;padding:12px 8px;text-align:center;" valign="top">
            <p style="margin:0 0 3px 0;${FONT}font-size:16px;font-weight:700;color:#06b6d4;font-feature-settings:'tnum';">${src.other}%</p>
            <p style="margin:0;${FONT}font-size:10px;color:#64748b;font-weight:600;text-transform:uppercase;">Other</p>
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
        <td style="padding:8px 0;border-bottom:1px solid #e2e8f0;${FONT}font-size:13px;color:#0f172a;width:60%;word-break:break-all;">${escapeHtml(p.path)}</td>
        <td style="padding:8px 8px;border-bottom:1px solid #e2e8f0;${FONT}font-size:13px;color:#0f172a;font-feature-settings:'tnum';white-space:nowrap;">${formatNumber(p.sessions)}</td>
        <td style="padding:8px 0;border-bottom:1px solid #e2e8f0;${FONT}font-size:13px;color:#64748b;font-feature-settings:'tnum';white-space:nowrap;">${p.pct_of_total}%</td>
      </tr>`
      )
      .join("");

    return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
  <tr>
    <td style="padding:0 32px 24px 32px;">
      <p style="margin:0 0 12px 0;${FONT}font-size:14px;font-weight:700;color:#0f172a;">Top Pages</p>
      <table cellpadding="0" cellspacing="0" border="0" width="100%">
        <thead>
          <tr>
            <th style="padding:0 0 6px 0;text-align:left;${FONT}font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase;border-bottom:2px solid #e2e8f0;">Page</th>
            <th style="padding:0 8px 6px 8px;text-align:left;${FONT}font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase;border-bottom:2px solid #e2e8f0;">Sessions</th>
            <th style="padding:0 0 6px 0;text-align:left;${FONT}font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase;border-bottom:2px solid #e2e8f0;">% Total</th>
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
      <p style="margin:0 0 8px 0;${FONT}font-size:14px;font-weight:700;color:#0f172a;">Keyword Rankings</p>
      <p style="margin:0 0 4px 0;${FONT}font-size:13px;color:#64748b;">${kw.ranking_count} / ${kw.tracked_count} phrases ranking &mdash; ${pct}% of phrases tracked</p>
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
          <td style="padding:6px 0;border-bottom:1px solid #e2e8f0;">
            <p style="margin:0 0 2px 0;${FONT}font-size:13px;color:#0f172a;">${escapeHtml(m.keyword)}</p>
            <p style="margin:0;${FONT}font-size:11px;color:#64748b;">${prior} &rarr; ${cur} <span style="color:#059669;">${escapeHtml(d.text)}</span></p>
          </td>
        </tr>`;
      })
      .join("");

    const downRows = kw.top_movers_down
      .map((m) => {
        const d = formatRankDelta(m.delta);
        const prior = m.prior_rank != null ? `#${m.prior_rank}` : "—";
        const cur = m.rank != null ? `#${m.rank}` : "dropped";
        return `
        <tr>
          <td style="padding:6px 0;border-bottom:1px solid #e2e8f0;">
            <p style="margin:0 0 2px 0;${FONT}font-size:13px;color:#0f172a;">${escapeHtml(m.keyword)}</p>
            <p style="margin:0;${FONT}font-size:11px;color:#64748b;">${prior} &rarr; ${cur} <span style="color:#dc2626;">${escapeHtml(d.text)}</span></p>
          </td>
        </tr>`;
      })
      .join("");

    return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
  <tr>
    <td style="padding:0 32px 24px 32px;">
      <p style="margin:0 0 4px 0;${FONT}font-size:14px;font-weight:700;color:#0f172a;">Keyword Rankings</p>
      <p style="margin:0 0 16px 0;${FONT}font-size:13px;color:#64748b;">${kw.ranking_count} / ${kw.tracked_count} phrases ranking &mdash; ${pct}% of phrases tracked</p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
          ${hasUp ? `<td style="width:${hasDown ? "50%" : "100%"};vertical-align:top;${hasDown ? "padding-right:12px;" : ""}">
            <p style="margin:0 0 8px 0;${FONT}font-size:11px;font-weight:600;color:#059669;text-transform:uppercase;">Top Movers Up</p>
            <table cellpadding="0" cellspacing="0" border="0" width="100%">${upRows}</table>
          </td>` : ""}
          ${hasDown ? `<td style="width:${hasUp ? "50%" : "100%"};vertical-align:top;${hasUp ? "padding-left:12px;" : ""}">
            <p style="margin:0 0 8px 0;${FONT}font-size:11px;font-weight:600;color:#dc2626;text-transform:uppercase;">Top Movers Down</p>
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
        const pill = `<span style="display:inline-block;padding:2px 8px;border-radius:4px;background:${s.bg};border:1px solid ${s.border};${FONT}font-size:10px;font-weight:600;color:${s.text};text-transform:uppercase;">${s.label}</span>`;
        return `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #e2e8f0;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td>
                ${pill}
                <p style="margin:4px 0 2px 0;${FONT}font-size:13px;font-weight:600;color:#0f172a;">${escapeHtml(issue.title)}</p>
                ${issue.page_url ? `<p style="margin:0;${FONT}font-size:11px;color:#64748b;">${escapeHtml(issue.page_url)}</p>` : ""}
              </td>
            </tr>
          </table>
        </td>
      </tr>`;
      })
      .join("");

    return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
  <tr>
    <td style="padding:0 32px 24px 32px;">
      <p style="margin:0 0 12px 0;${FONT}font-size:14px;font-weight:700;color:#0f172a;">What Needs Attention</p>
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
        <td style="padding:8px 0;border-bottom:1px solid #e2e8f0;">
          <p style="margin:0;${FONT}font-size:13px;color:#0f172a;"><span style="color:#059669;">&#10003;</span> ${escapeHtml(r.title)}</p>
        </td>
      </tr>`
      )
      .join("");

    return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
  <tr>
    <td style="padding:0 32px 24px 32px;">
      <p style="margin:0 0 12px 0;${FONT}font-size:14px;font-weight:700;color:#0f172a;">Resolved This Period</p>
      <table cellpadding="0" cellspacing="0" border="0" width="100%">
        ${rows}
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
    <td style="padding:0 32px 24px 32px;">
      <p style="margin:0 0 12px 0;${FONT}font-size:14px;font-weight:700;color:#0f172a;">What This Means</p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
          <td style="padding:16px 20px;background:#f8fafc;border-left:4px solid #06b6d4;border-radius:0 4px 4px 0;">
            <p style="margin:0;${FONT}font-size:14px;color:#334155;line-height:1.6;">${escapeHtml(data.ai_summary).replace(/\n\n+/g, "</p><p style=\"margin:12px 0 0 0;\">").replace(/\n/g, "<br/>")}</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
  }

  function buildCtaButton(): string {
    return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
  <tr>
    <td style="padding:0 32px 32px 32px;text-align:center;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
        <tr>
          <td style="background:#06b6d4;border-radius:8px;">
            <a href="${escapeHtml(dashboardUrl)}" style="${FONT}display:inline-block;padding:12px 24px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">View live dashboard</a>
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
    <td style="padding:16px 32px 0 32px;border-top:1px solid #e2e8f0;text-align:center;">
      <p style="margin:0 0 4px 0;${FONT}font-size:12px;color:#94a3b8;">Delivered by Niewdel &middot; ${escapeHtml(generatedDate)}</p>
      <p style="margin:0;${FONT}font-size:12px;color:#94a3b8;">If you have questions, just reply to this email.</p>
    </td>
  </tr>
</table>`;
  }

  // ── Assemble ──────────────────────────────────────────────────────────────

  const body = [
    buildHeader(),
    buildOverallScoreHero(),
    buildScoreCards(),
    buildOpenIssues(),
    buildTrafficSection(),
    buildTopPages(),
    buildKeywordRankings(),
    buildWhatNeedsAttention(),
    buildResolved(),
    buildAiSummary(),
    buildCtaButton(),
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
<body style="margin:0;padding:0;background:#f1f5f9;${FONT}">
<!--[if mso]><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td><![endif]-->
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f1f5f9;">
  <tr>
    <td style="padding:24px 0;" align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;">
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
