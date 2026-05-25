import type { FixPlan, CategoryFixPlan, FixItem } from './fix-plan';

// Niewdel v2 palette, email-safe inline hex.
const PAPER = '#F5F1EA';
const PAPER_RAISED = '#FBF8F2';
const PAPER_EDGE = '#E3DDD2';
const INK = '#1A1410';
const INK_SOFT = '#665E54';
const INK_FAINT = '#8E867C';
const RUST = '#C84B31';
const RUST_DEEP = '#8F3623';
const SAGE = '#5C7F4F';
const GOLD = '#B58A5C';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getScoreColor(score: number): string {
  if (score <= 40) return RUST_DEEP;
  if (score <= 65) return GOLD;
  if (score <= 85) return SAGE;
  return INK;
}

// Map technical difficulty + raw time estimate to a single plain-English chip.
function effortLabel(fix: FixItem): string {
  if (fix.difficulty === 'easy') return 'Quick win';
  if (fix.difficulty === 'moderate') return 'Half day';
  if (fix.difficulty === 'advanced') return 'Multi-day';
  return fix.timeEstimate;
}

function priorityLabel(priority: string): string {
  switch (priority) {
    case 'critical': return 'Top priority';
    case 'high': return 'High priority';
    case 'medium': return 'Worth doing';
    case 'low': return 'Nice to have';
    default: return priority;
  }
}

function priorityColor(priority: string): string {
  switch (priority) {
    case 'critical': return RUST_DEEP;
    case 'high': return RUST;
    case 'medium': return GOLD;
    default: return INK_SOFT;
  }
}

function renderFix(fix: FixItem, idx: number): string {
  return `
    <li class="fix-row">
      <span class="fix-num">${String(idx + 1).padStart(2, '0')}</span>
      <div class="fix-body">
        <p class="fix-title">${escapeHtml(fix.finding)}</p>
        <p class="fix-meta">
          <span class="fix-pill" style="background: ${priorityColor(fix.priority)}15; color: ${priorityColor(fix.priority)};">${escapeHtml(priorityLabel(fix.priority))}</span>
          <span class="fix-sep">·</span>
          <span class="fix-effort">${escapeHtml(effortLabel(fix))}</span>
        </p>
      </div>
    </li>`;
}

function renderCategory(cat: CategoryFixPlan): string {
  // Cap each category at 3 fixes per the plan. Anything beyond that
  // turns the report back into a wall of text.
  const top = cat.fixes.slice(0, 3);
  if (top.length === 0) return '';
  const fixesHtml = top.map((f, i) => renderFix(f, i)).join('');
  return `
    <section class="cat">
      <header class="cat-header">
        <p class="mono-tag-muted">${escapeHtml(cat.category_name)}</p>
        <p class="cat-score">${cat.currentScore} <span class="cat-arrow">&rarr;</span> <span class="cat-score-target">${cat.targetScore}</span></p>
      </header>
      <ul class="fix-list">${fixesHtml}</ul>
    </section>`;
}

export function generateFixPlanHtml(plan: FixPlan, logoDataUri?: string): string {
  const currentColor = getScoreColor(plan.currentScore);
  const projectedColor = getScoreColor(plan.projectedScore);

  const logoBlock = logoDataUri
    ? `<img src="${logoDataUri}" alt="Niewdel" style="height: 32px; width: auto; display: block;" />`
    : `<span style="font-family:'Inter',sans-serif;font-weight:700;font-size:22px;letter-spacing:-0.01em;color:${INK};">niewdel</span>`;

  // Top priorities = the FixPlan's "quick wins" list, capped at 5 and
  // re-framed away from the "quick wins" language.
  const topFixesHtml = plan.quickWins
    .slice(0, 5)
    .map((f, i) => renderFix(f, i))
    .join('');

  const categoriesHtml = plan.categories.map(renderCategory).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Fix Plan, ${escapeHtml(plan.siteName)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600&display=swap" rel="stylesheet" />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: ${PAPER};
      color: ${INK};
      line-height: 1.6;
      -webkit-font-smoothing: antialiased;
    }
    .container { max-width: 720px; margin: 0 auto; padding: 0 36px; }

    .mono-tag {
      font-family: 'JetBrains Mono', monospace; font-weight: 600;
      font-size: 11px; letter-spacing: 0.22em; text-transform: uppercase;
      color: ${RUST};
    }
    .mono-tag-muted {
      font-family: 'JetBrains Mono', monospace; font-weight: 600;
      font-size: 11px; letter-spacing: 0.22em; text-transform: uppercase;
      color: ${INK_SOFT};
    }

    /* Header */
    .header {
      padding: 80px 36px 32px;
      max-width: 720px; margin: 0 auto;
    }
    .header-tag { margin-bottom: 36px; }
    .header-logo { margin-bottom: 28px; }
    .header-headline {
      font-family: 'Inter', sans-serif; font-weight: 700;
      font-size: 38px; line-height: 1.08; letter-spacing: -0.015em;
      color: ${INK}; max-width: 540px; margin-bottom: 16px;
    }
    .header-headline-rust { color: ${RUST}; }
    .header-meta { font-size: 14px; color: ${INK_SOFT}; }

    /* Projected score card */
    .scorecard {
      margin: 48px auto 32px;
      max-width: 720px;
      background: ${INK};
      color: ${PAPER};
      border-radius: 12px;
      padding: 36px 40px;
    }
    .scorecard-tag {
      font-family: 'JetBrains Mono', monospace; font-weight: 600;
      font-size: 11px; letter-spacing: 0.22em; text-transform: uppercase;
      color: ${PAPER_EDGE}; margin-bottom: 16px; opacity: 0.55;
    }
    .scorecard-grid { display: flex; align-items: baseline; gap: 28px; }
    .scorecard-cell { flex: 1; }
    .scorecard-label {
      font-family: 'JetBrains Mono', monospace; font-weight: 600;
      font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase;
      color: ${PAPER_EDGE}; opacity: 0.55; margin-bottom: 8px;
    }
    .scorecard-value {
      font-family: 'Inter', sans-serif; font-weight: 700;
      font-size: 48px; line-height: 1; letter-spacing: -0.02em;
    }
    .scorecard-arrow { font-size: 22px; color: ${PAPER_EDGE}; opacity: 0.5; }

    /* Section */
    .section { padding: 32px 0 16px; }
    .section-tag { margin-bottom: 14px; }
    .section-headline {
      font-family: 'Inter', sans-serif; font-weight: 700;
      font-size: 26px; line-height: 1.2; letter-spacing: -0.012em;
      color: ${INK}; margin-bottom: 24px;
    }

    /* Fix list */
    .fix-list { list-style: none; padding: 0; }
    .fix-row {
      display: flex; align-items: flex-start; gap: 20px;
      padding: 18px 0;
      border-top: 1px solid ${PAPER_EDGE};
    }
    .fix-row:last-child { border-bottom: 1px solid ${PAPER_EDGE}; }
    .fix-num {
      font-family: 'JetBrains Mono', monospace; font-weight: 600;
      font-size: 13px; color: ${RUST};
      letter-spacing: 0.05em; flex-shrink: 0; padding-top: 2px;
      min-width: 28px;
    }
    .fix-body { flex: 1; min-width: 0; }
    .fix-title {
      font-size: 15px; font-weight: 500; color: ${INK};
      line-height: 1.5; margin-bottom: 6px;
    }
    .fix-meta { display: flex; align-items: center; gap: 8px; }
    .fix-pill {
      font-family: 'JetBrains Mono', monospace; font-weight: 600;
      font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase;
      padding: 3px 8px; border-radius: 4px;
    }
    .fix-sep { color: ${INK_FAINT}; font-size: 12px; }
    .fix-effort {
      font-family: 'JetBrains Mono', monospace; font-weight: 600;
      font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase;
      color: ${INK_SOFT};
    }

    /* Categories */
    .categories { padding: 24px 0 8px; }
    .cat { padding: 28px 0 8px; }
    .cat-header {
      display: flex; align-items: baseline; justify-content: space-between;
      gap: 16px; margin-bottom: 8px;
    }
    .cat-score {
      font-family: 'Inter', sans-serif; font-weight: 700; font-size: 18px;
      color: ${INK_SOFT};
    }
    .cat-arrow { color: ${INK_FAINT}; font-weight: 500; padding: 0 2px; }
    .cat-score-target { color: ${SAGE}; }

    /* Footer */
    .footer {
      padding: 56px 36px 56px;
      max-width: 720px; margin: 32px auto 0;
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
    .footer-contact { font-size: 13px; color: ${INK_SOFT}; }
    .footer-contact a { color: ${RUST}; text-decoration: none; font-weight: 600; }
    .footer-note {
      font-size: 11px; color: ${INK_FAINT}; margin-top: 16px;
    }

    @media print {
      body { background: #fff; }
      .scorecard { background: ${INK}; page-break-inside: avoid; }
      .cat, .fix-row { page-break-inside: avoid; }
    }
  </style>
</head>
<body>

  <!-- Header -->
  <header class="header">
    <div class="header-tag mono-tag">Fix Plan · ${escapeHtml(plan.auditDate)}</div>
    <div class="header-logo">${logoBlock}</div>
    <h1 class="header-headline">
      What we'd fix on <span class="header-headline-rust">${escapeHtml(plan.siteName)}</span>.
    </h1>
    <div class="header-meta">${escapeHtml(plan.url)}</div>
  </header>

  <!-- Score Card -->
  <div class="scorecard">
    <div class="scorecard-tag">Where this gets you</div>
    <div class="scorecard-grid">
      <div class="scorecard-cell">
        <div class="scorecard-label">Today</div>
        <div class="scorecard-value" style="color: ${currentColor === INK ? PAPER : currentColor};">${plan.currentScore}</div>
      </div>
      <div class="scorecard-arrow">&rarr;</div>
      <div class="scorecard-cell">
        <div class="scorecard-label">After</div>
        <div class="scorecard-value" style="color: ${projectedColor === INK ? PAPER : projectedColor};">${plan.projectedScore}</div>
      </div>
    </div>
  </div>

  <div class="container">

    <!-- Top fixes -->
    ${topFixesHtml ? `
    <section class="section">
      <div class="section-tag mono-tag">01 · What we'd tackle first</div>
      <h2 class="section-headline">The fastest path to a better score.</h2>
      <ul class="fix-list">${topFixesHtml}</ul>
    </section>
    ` : ''}

    <!-- By category -->
    ${categoriesHtml ? `
    <section class="categories">
      <div class="section-tag mono-tag">02 · The full plan</div>
      <h2 class="section-headline">Broken down by area.</h2>
      ${categoriesHtml}
    </section>
    ` : ''}

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
    <p class="footer-note">Prepared for ${escapeHtml(plan.siteName)}. ${escapeHtml(plan.auditDate)}.</p>
  </div>

</body>
</html>`;
}
