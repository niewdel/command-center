import type { AuditResult, CategoryResult } from './types';

// Niewdel v2 palette, email-safe inline hex.
const PAPER = '#F5F1EA';
const PAPER_RAISED = '#FBF8F2';
const PAPER_EDGE = '#E3DDD2';
const INK = '#1A1410';
const INK_SOFT = '#665E54';
const INK_FAINT = '#8E867C';
const RUST = '#C84B31';
const RUST_HOT = '#E36548';
const RUST_DEEP = '#8F3623';
const SAGE = '#5C7F4F';
const GOLD = '#B58A5C';

function getScoreColor(score: number): string {
  if (score <= 40) return RUST_DEEP;
  if (score <= 65) return GOLD;
  if (score <= 85) return SAGE;
  return INK;
}

function getScoreLabel(score: number): string {
  if (score <= 40) return 'Major issues';
  if (score <= 65) return 'Needs work';
  if (score <= 85) return 'On track';
  return 'Strong';
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Pick the top 5 issues worth surfacing. Prefer findings from the
// lowest-scoring categories, one per category, until we have 5. Each
// finding is already plain English from the audit runner.
function pickTopIssues(categories: CategoryResult[]): { area: string; issue: string }[] {
  const sorted = [...categories]
    .filter((c) => c.findings.length > 0)
    .sort((a, b) => a.score - b.score);

  const out: { area: string; issue: string }[] = [];
  for (const cat of sorted) {
    if (out.length >= 5) break;
    out.push({ area: cat.category_name, issue: cat.findings[0] });
  }
  // If a single low-scoring category has dominated and we still have room,
  // pull a second finding from the worst one.
  if (out.length < 5 && sorted[0]?.findings.length > 1) {
    out.push({ area: sorted[0].category_name, issue: sorted[0].findings[1] });
  }
  return out;
}

// Rough "after we fix this" projection. A site at score N could realistically
// land at around min(95, N + 30) after a targeted improvement pass.
function projectedScore(current: number): number {
  return Math.min(95, current + 30);
}

export function generateHtmlReport(result: AuditResult, logoDataUri?: string): string {
  const overallColor = getScoreColor(result.overall_score);
  const overallLabel = getScoreLabel(result.overall_score);
  const projected = projectedScore(result.overall_score);
  const projectedColor = getScoreColor(projected);
  const projectedLabel = getScoreLabel(projected);

  const issues = pickTopIssues(result.categories);
  const issuesHtml = issues
    .map(
      (it, i) => `
        <li class="issue-row">
          <span class="issue-num">${String(i + 1).padStart(2, '0')}</span>
          <div class="issue-body">
            <p class="issue-area">${escapeHtml(it.area)}</p>
            <p class="issue-text">${escapeHtml(it.issue)}</p>
          </div>
        </li>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Website Audit, ${escapeHtml(result.siteName)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600&display=swap" rel="stylesheet" />
  <style>
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: ${PAPER};
      color: ${INK};
      line-height: 1.65;
      -webkit-font-smoothing: antialiased;
    }

    .container { max-width: 720px; margin: 0 auto; padding: 0 36px; }

    .mono-tag {
      font-family: 'JetBrains Mono', monospace;
      font-weight: 600;
      font-size: 11px;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      color: ${RUST};
    }
    .mono-tag-muted {
      font-family: 'JetBrains Mono', monospace;
      font-weight: 600;
      font-size: 11px;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      color: ${INK_SOFT};
    }

    /* ── Cover ─────────────────────────────────────────── */

    .cover {
      padding: 96px 36px 48px;
      text-align: left;
      max-width: 720px;
      margin: 0 auto;
    }
    .cover-tag { margin-bottom: 36px; }
    .cover-logo { margin-bottom: 28px; }
    .cover-logo img { height: 38px; width: auto; display: block; }
    .cover-logo-text {
      font-family: 'Inter', sans-serif; font-weight: 700; font-size: 22px;
      letter-spacing: -0.01em; color: ${INK};
    }
    .cover-headline {
      font-family: 'Inter', sans-serif; font-weight: 700; font-size: 38px;
      line-height: 1.08; letter-spacing: -0.015em; color: ${INK};
      max-width: 580px; margin-bottom: 16px;
    }
    .cover-headline-rust { color: ${RUST}; }
    .cover-meta {
      font-size: 14px; color: ${INK_SOFT}; line-height: 1.6;
    }
    .cover-meta-row { margin-top: 4px; }

    /* ── Big score card ────────────────────────────────── */

    .score-card {
      margin: 48px 36px 56px;
      max-width: 720px;
      margin-left: auto; margin-right: auto;
      background: ${PAPER_RAISED};
      border: 1px solid ${PAPER_EDGE};
      border-radius: 12px;
      padding: 40px 44px;
    }
    .score-card-row {
      display: flex; align-items: baseline; justify-content: space-between;
      gap: 28px;
    }
    .score-card-block { flex: 1; }
    .score-card-tag { margin-bottom: 10px; }
    .score-card-number {
      font-family: 'Inter', sans-serif; font-weight: 700; font-size: 64px;
      line-height: 1; letter-spacing: -0.03em;
    }
    .score-card-number-of {
      font-family: 'Inter', sans-serif; font-weight: 500; font-size: 22px;
      color: ${INK_FAINT}; margin-left: 4px;
    }
    .score-card-label {
      font-size: 13px; font-weight: 600; margin-top: 8px;
      text-transform: uppercase; letter-spacing: 0.12em;
    }
    .score-card-arrow {
      font-size: 22px; color: ${INK_FAINT}; padding: 0 6px;
    }

    /* ── Summary section ───────────────────────────────── */

    .section { padding: 28px 0 8px; }
    .section-tag { margin-bottom: 14px; }
    .section-headline {
      font-family: 'Inter', sans-serif; font-weight: 700;
      font-size: 26px; line-height: 1.2; letter-spacing: -0.012em;
      color: ${INK}; margin-bottom: 16px;
    }
    .section-body {
      font-size: 15px; color: ${INK_SOFT}; line-height: 1.7;
      max-width: 620px;
    }

    /* ── Top 5 issues ──────────────────────────────────── */

    .issues { padding: 32px 0 12px; }
    .issues-list { list-style: none; padding: 0; }
    .issue-row {
      display: flex; align-items: flex-start; gap: 20px;
      padding: 20px 0;
      border-top: 1px solid ${PAPER_EDGE};
    }
    .issue-row:last-child { border-bottom: 1px solid ${PAPER_EDGE}; }
    .issue-num {
      font-family: 'JetBrains Mono', monospace; font-weight: 600;
      font-size: 13px; color: ${RUST};
      letter-spacing: 0.05em; flex-shrink: 0; padding-top: 2px;
      min-width: 28px;
    }
    .issue-body { flex: 1; min-width: 0; }
    .issue-area {
      font-family: 'JetBrains Mono', monospace; font-weight: 600;
      font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase;
      color: ${INK_SOFT}; margin-bottom: 4px;
    }
    .issue-text {
      font-size: 15px; color: ${INK}; line-height: 1.55;
    }

    /* ── Projection callout ────────────────────────────── */

    .projection {
      margin: 48px 0 0;
      background: ${INK};
      border-radius: 12px;
      padding: 36px 40px;
      color: ${PAPER};
    }
    .projection-tag {
      font-family: 'JetBrains Mono', monospace; font-weight: 600;
      font-size: 11px; letter-spacing: 0.22em; text-transform: uppercase;
      color: ${RUST_HOT}; margin-bottom: 12px;
    }
    .projection-headline {
      font-family: 'Inter', sans-serif; font-weight: 700;
      font-size: 22px; line-height: 1.3; margin-bottom: 24px;
      max-width: 460px;
    }
    .projection-grid {
      display: flex; align-items: baseline; gap: 28px;
    }
    .projection-cell { flex: 1; }
    .projection-cell-label {
      font-family: 'JetBrains Mono', monospace; font-weight: 600;
      font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase;
      color: ${PAPER_EDGE}; margin-bottom: 8px; opacity: 0.55;
    }
    .projection-cell-value {
      font-family: 'Inter', sans-serif; font-weight: 700; font-size: 48px;
      line-height: 1; letter-spacing: -0.02em;
    }
    .projection-arrow {
      font-size: 24px; color: ${PAPER_EDGE}; opacity: 0.5;
    }

    /* ── Footer ────────────────────────────────────────── */

    .footer {
      padding: 56px 36px 56px;
      max-width: 720px; margin: 24px auto 0;
      border-top: 1px solid ${PAPER_EDGE};
    }
    .footer-inner {
      display: flex; align-items: center; justify-content: space-between;
      gap: 16px;
    }
    .footer-brand {
      font-family: 'Inter', sans-serif; font-weight: 700; font-size: 16px;
      letter-spacing: -0.01em; color: ${INK};
    }
    .footer-contact {
      font-size: 13px; color: ${INK_SOFT};
    }
    .footer-contact a { color: ${RUST}; text-decoration: none; font-weight: 600; }
    .footer-note {
      font-size: 11px; color: ${INK_FAINT}; margin-top: 16px;
      letter-spacing: 0.04em;
    }

    /* ── Print ─────────────────────────────────────────── */

    @media print {
      body { background: #fff; }
      .cover, .container { max-width: none; }
      .score-card, .projection { page-break-inside: avoid; }
      .projection { background: ${INK}; }
    }
  </style>
</head>
<body>

  <!-- Cover -->
  <div class="cover">
    <div class="cover-tag mono-tag">Website Audit · ${escapeHtml(result.auditDate)}</div>
    <div class="cover-logo">${
      logoDataUri
        ? `<img src="${logoDataUri}" alt="Niewdel" />`
        : `<span class="cover-logo-text">niewdel</span>`
    }</div>
    <h1 class="cover-headline">
      Audit for <span class="cover-headline-rust">${escapeHtml(result.siteName)}</span>.
    </h1>
    <div class="cover-meta">
      <div>${escapeHtml(result.url)}</div>
      <div class="cover-meta-row">${result.pagesCrawled} page${result.pagesCrawled !== 1 ? 's' : ''} reviewed.</div>
    </div>
  </div>

  <!-- Score Card -->
  <div class="score-card">
    <div class="score-card-row">
      <div class="score-card-block">
        <div class="score-card-tag mono-tag-muted">Your Score</div>
        <div>
          <span class="score-card-number" style="color: ${overallColor};">${result.overall_score}</span>
          <span class="score-card-number-of">/100</span>
        </div>
        <div class="score-card-label" style="color: ${overallColor};">${overallLabel}</div>
      </div>
    </div>
  </div>

  <div class="container">

    <!-- Executive Summary -->
    <section class="section">
      <div class="section-tag mono-tag">01 · Summary</div>
      <h2 class="section-headline">${escapeHtml(result.overall_headline)}</h2>
      <p class="section-body">${escapeHtml(result.overall_narrative)}</p>
    </section>

    <!-- Top Issues -->
    <section class="issues">
      <div class="section-tag mono-tag">02 · What we'd fix first</div>
      <h2 class="section-headline">The biggest opportunities.</h2>
      <ul class="issues-list">
        ${issuesHtml}
      </ul>
    </section>

    <!-- Projection -->
    <section class="projection">
      <div class="projection-tag">03 · After our fixes</div>
      <p class="projection-headline">A focused plan can lift this site to a stronger score.</p>
      <div class="projection-grid">
        <div class="projection-cell">
          <div class="projection-cell-label">Today</div>
          <div class="projection-cell-value" style="color: ${overallColor === INK ? PAPER : overallColor};">${result.overall_score}</div>
        </div>
        <div class="projection-arrow">&rarr;</div>
        <div class="projection-cell">
          <div class="projection-cell-label">After</div>
          <div class="projection-cell-value" style="color: ${projectedColor === INK ? PAPER : projectedColor};">${projected}</div>
        </div>
      </div>
    </section>

  </div>

  <!-- Footer -->
  <div class="footer">
    <div class="footer-inner">
      <div class="footer-brand">${
        logoDataUri
          ? `<img src="${logoDataUri}" alt="Niewdel" style="height: 22px; width: auto;" />`
          : `niewdel`
      }</div>
      <div class="footer-contact">
        Built by Niewdel. <a href="https://niewdel.com">niewdel.com</a>
      </div>
    </div>
    <p class="footer-note">Prepared for ${escapeHtml(result.siteName)}. ${escapeHtml(result.auditDate)}.</p>
  </div>

</body>
</html>`;
}
