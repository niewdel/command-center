import type { FixPlan, CategoryFixPlan, FixItem } from './fix-plan';

// Niewdel v2 palette, email-safe inline hex.
const PAPER = '#F5F1EA';
const PAPER_RAISED = '#FBF8F2';
const PAPER_SUNKEN = '#EDE7DC';
const PAPER_EDGE = '#E3DDD2';
const INK = '#1A1410';
const INK_SOFT = '#665E54';
const INK_FAINT = '#8E867C';
const RUST = '#C84B31';
const RUST_DEEP = '#8F3623';
const SAGE = '#5C7F4F';
const GOLD = '#B58A5C';
const WALNUT = '#6B4A2E';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getPriorityColor(priority: string): string {
  switch (priority) {
    case 'critical': return RUST_DEEP;
    case 'high': return RUST;
    case 'medium': return GOLD;
    case 'low': return INK_FAINT;
    default: return INK_FAINT;
  }
}

function getDifficultyColor(difficulty: string): string {
  switch (difficulty) {
    case 'easy': return SAGE;
    case 'moderate': return GOLD;
    case 'advanced': return RUST_DEEP;
    default: return INK_FAINT;
  }
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

function effortLabel(d: string): string {
  if (d === 'easy') return 'Quick win';
  if (d === 'moderate') return 'Half day';
  if (d === 'advanced') return 'Multi-day';
  return d;
}

function getScoreColor(score: number): string {
  if (score <= 40) return RUST_DEEP;
  if (score <= 65) return GOLD;
  if (score <= 85) return SAGE;
  return WALNUT;
}

function renderBadge(text: string, color: string): string {
  return `<span class="badge" style="background: ${color}15; color: ${color}; border-color: ${color}40;">${escapeHtml(text)}</span>`;
}

function renderFixCard(fix: FixItem, index?: number): string {
  const numberHtml = index !== undefined
    ? `<span class="fix-number">${String(index + 1).padStart(2, '0')}</span>`
    : '';
  return `
    <div class="fix-card">
      <div class="fix-card-header">
        ${numberHtml}
        <div class="fix-badges">
          ${renderBadge(priorityLabel(fix.priority), getPriorityColor(fix.priority))}
          ${renderBadge(effortLabel(fix.difficulty), getDifficultyColor(fix.difficulty))}
        </div>
      </div>
      <div class="fix-card-body">
        <div class="fix-problem">
          <span class="fix-label">Problem</span>
          <span class="fix-problem-text">${escapeHtml(fix.finding)}</span>
        </div>
        <div class="fix-instruction">
          <span class="fix-label">Fix</span>
          <span class="fix-instruction-text">${escapeHtml(fix.fix)}</span>
        </div>
        <div class="fix-meta">
          <span class="fix-meta-item">&#9200; ${escapeHtml(fix.timeEstimate)}</span>
          <span class="fix-meta-item">&#9889; ${escapeHtml(fix.impact)}</span>
        </div>
      </div>
    </div>`;
}

function renderQuickWins(fixes: FixItem[]): string {
  if (fixes.length === 0) return '';
  const cardsHtml = fixes.map((fix, i) => renderFixCard(fix, i)).join('');
  return `
    <section class="section">
      <p class="section-tag">01 · Start here</p>
      <h2 class="section-title">What we tackle first</h2>
      <p class="section-subtitle">The ${fixes.length} highest-impact, lowest-effort fixes.</p>
      <div class="fix-cards">${cardsHtml}</div>
    </section>`;
}

function renderScoreProjection(categories: CategoryFixPlan[]): string {
  const barsHtml = categories.map((cat) => {
    const delta = cat.targetScore - cat.currentScore;
    const currentColor = getScoreColor(cat.currentScore);
    const targetColor = getScoreColor(cat.targetScore);
    return `
      <div class="projection-row">
        <div class="projection-label">${escapeHtml(cat.category_name)}</div>
        <div class="projection-bars">
          <div class="projection-bar-track">
            <div class="projection-bar target-bar" style="width: ${cat.targetScore}%; background: ${targetColor}; opacity: 0.3;"></div>
            <div class="projection-bar current-bar" style="width: ${cat.currentScore}%; background: ${currentColor};"></div>
          </div>
          <div class="projection-scores">
            <span class="projection-current">${cat.currentScore}</span>
            <span class="projection-arrow">&rarr;</span>
            <span class="projection-target" style="color: ${targetColor};">${cat.targetScore}</span>
            <span class="projection-delta" style="color: ${targetColor};">+${delta}</span>
          </div>
        </div>
      </div>`;
  }).join('');

  return `
    <section class="section">
      <p class="section-tag">02 · Projection</p>
      <h2 class="section-title">Where this gets you</h2>
      <p class="section-subtitle">Current scores vs. projected after all fixes are applied.</p>
      <div class="projection-chart">${barsHtml}</div>
    </section>`;
}

function renderCategorySection(cat: CategoryFixPlan, index: number): string {
  const delta = cat.targetScore - cat.currentScore;
  const currentColor = getScoreColor(cat.currentScore);
  const targetColor = getScoreColor(cat.targetScore);
  const fixesHtml = cat.fixes.map((fix) => renderFixCard(fix)).join('');
  const num = String(index + 1).padStart(2, '0');
  return `
    <section class="section category-section">
      <div class="category-header">
        <div class="category-title-area">
          <span class="cat-num">${num}</span>
          <h2 class="category-name">${escapeHtml(cat.category_name)}</h2>
          <span class="fix-count">${cat.fixes.length} fix${cat.fixes.length !== 1 ? 'es' : ''}</span>
        </div>
        <div class="category-score-area">
          <span class="cat-score" style="color: ${currentColor};">${cat.currentScore}</span>
          <span class="cat-arrow">&rarr;</span>
          <span class="cat-score" style="color: ${targetColor};">${cat.targetScore}</span>
          <span class="cat-delta" style="color: ${targetColor};">+${delta}</span>
        </div>
      </div>
      <div class="fix-cards">${fixesHtml}</div>
    </section>`;
}

export function generateFixPlanHtml(plan: FixPlan, logoDataUri?: string): string {
  const currentColor = getScoreColor(plan.currentScore);
  const projectedColor = getScoreColor(plan.projectedScore);

  const logoHtml = logoDataUri
    ? `<img src="${logoDataUri}" alt="Niewdel" class="header-logo" />`
    : `<span class="header-logo-text">niewdel</span>`;

  const quickWinsHtml = renderQuickWins(plan.quickWins);
  const projectionHtml = renderScoreProjection(plan.categories);
  const categoriesHtml = plan.categories
    .map((cat, i) => renderCategorySection(cat, i))
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Fix Plan, ${escapeHtml(plan.siteName)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600&display=swap" rel="stylesheet" />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: ${PAPER};
      color: ${INK};
      line-height: 1.6;
      -webkit-font-smoothing: antialiased;
    }
    .container { max-width: 940px; margin: 0 auto; padding: 48px 36px; }

    .section-tag {
      font-family: 'JetBrains Mono', monospace; font-weight: 600;
      font-size: 11px; letter-spacing: 0.22em; text-transform: uppercase;
      color: ${RUST}; margin-bottom: 12px;
    }

    /* Header */
    .report-header { padding-bottom: 32px; border-bottom: 1px solid ${PAPER_EDGE}; margin-bottom: 40px; }
    .header-logo { height: 36px; margin-bottom: 16px; display: block; }
    .header-logo-text {
      font-family: 'Inter', sans-serif; font-weight: 700;
      font-size: 24px; letter-spacing: -0.02em; color: ${INK};
      display: block; margin-bottom: 16px;
    }
    .header-tag { margin-bottom: 18px; }
    .header-site-name {
      font-family: 'Inter', sans-serif; font-weight: 700; font-size: 32px;
      color: ${INK}; letter-spacing: -0.02em; margin-bottom: 4px;
    }
    .header-url { font-size: 14px; color: ${INK_SOFT}; margin-bottom: 24px; }

    .header-scores { display: flex; align-items: center; gap: 18px; }
    .score-cell { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; }
    .header-score {
      font-family: 'Inter', sans-serif; font-weight: 800; font-size: 44px;
      letter-spacing: -0.025em; font-variant-numeric: tabular-nums; line-height: 1;
    }
    .header-score-label {
      font-family: 'JetBrains Mono', monospace; font-size: 10px;
      color: ${INK_SOFT}; text-transform: uppercase; letter-spacing: 0.22em;
    }
    .header-arrow { font-size: 24px; color: ${INK_FAINT}; }
    .header-date { font-size: 12px; color: ${INK_FAINT}; margin-top: 16px; }

    /* Section shared */
    .section { margin-bottom: 44px; }
    .section-title {
      font-family: 'Inter', sans-serif; font-weight: 700; font-size: 26px;
      color: ${INK}; margin-bottom: 8px; letter-spacing: -0.015em;
    }
    .section-subtitle { font-size: 14px; color: ${INK_SOFT}; margin-bottom: 24px; max-width: 60ch; }

    /* Fix Cards */
    .fix-cards { display: flex; flex-direction: column; gap: 14px; }
    .fix-card {
      background: ${PAPER_RAISED};
      border: 1px solid ${PAPER_EDGE};
      border-radius: 10px; padding: 18px 20px;
    }
    .fix-card-header {
      display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; gap: 12px;
    }
    .fix-number {
      font-family: 'JetBrains Mono', monospace; font-weight: 600; font-size: 13px;
      color: ${RUST}; letter-spacing: 0.06em;
    }
    .fix-badges { display: flex; gap: 6px; flex-wrap: wrap; }
    .badge {
      font-family: 'JetBrains Mono', monospace; font-size: 10px; font-weight: 600;
      text-transform: uppercase; letter-spacing: 0.14em;
      padding: 3px 9px; border-radius: 4px; border: 1px solid; white-space: nowrap;
    }
    .fix-card-body { display: flex; flex-direction: column; gap: 8px; }
    .fix-label {
      font-family: 'JetBrains Mono', monospace; font-weight: 600;
      font-size: 10px; color: ${INK_FAINT}; text-transform: uppercase;
      letter-spacing: 0.18em; margin-right: 8px; flex-shrink: 0;
    }
    .fix-problem, .fix-instruction { display: flex; align-items: baseline; gap: 8px; }
    .fix-problem-text { color: ${RUST_DEEP}; font-size: 14px; line-height: 1.55; }
    .fix-instruction-text { color: ${INK}; font-size: 14px; line-height: 1.55; }
    .fix-meta { display: flex; gap: 18px; margin-top: 6px; }
    .fix-meta-item { font-size: 12px; color: ${INK_SOFT}; }

    /* Score Projection */
    .projection-chart { display: flex; flex-direction: column; gap: 12px; }
    .projection-row { display: flex; align-items: center; gap: 14px; }
    .projection-label {
      width: 200px; flex-shrink: 0; font-size: 13px; font-weight: 500;
      color: ${INK}; text-align: right;
    }
    .projection-bars { flex: 1; display: flex; align-items: center; gap: 14px; }
    .projection-bar-track {
      flex: 1; height: 22px;
      background: ${PAPER_SUNKEN};
      border-radius: 4px; position: relative; overflow: hidden;
    }
    .projection-bar {
      position: absolute; top: 0; left: 0; height: 100%;
      border-radius: 4px;
    }
    .target-bar { z-index: 0; }
    .current-bar { z-index: 1; }
    .projection-scores {
      display: flex; align-items: center; gap: 6px; width: 150px; flex-shrink: 0;
      font-size: 13px; font-family: 'JetBrains Mono', monospace; font-variant-numeric: tabular-nums;
    }
    .projection-current { color: ${INK_SOFT}; font-weight: 600; }
    .projection-arrow { color: ${INK_FAINT}; }
    .projection-target { font-weight: 700; }
    .projection-delta { font-size: 11px; font-weight: 600; margin-left: 4px; }

    /* Category Sections */
    .category-section {
      background: ${PAPER_RAISED};
      border: 1px solid ${PAPER_EDGE};
      border-radius: 12px; padding: 28px 32px;
    }
    .category-header {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 18px; gap: 14px;
    }
    .category-title-area { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    .cat-num {
      font-family: 'JetBrains Mono', monospace; font-weight: 600; font-size: 12px;
      color: ${INK_FAINT}; background: ${PAPER_SUNKEN};
      width: 30px; height: 30px; border-radius: 6px;
      display: flex; align-items: center; justify-content: center;
    }
    .category-name {
      font-family: 'Inter', sans-serif; font-weight: 700; font-size: 18px;
      color: ${INK}; letter-spacing: -0.01em;
    }
    .fix-count {
      font-family: 'JetBrains Mono', monospace; font-size: 10px; font-weight: 600;
      color: ${INK_SOFT}; text-transform: uppercase; letter-spacing: 0.18em;
      background: ${PAPER_SUNKEN}; padding: 3px 10px; border-radius: 999px;
    }
    .category-score-area {
      display: flex; align-items: center; gap: 8px;
      font-family: 'JetBrains Mono', monospace; font-variant-numeric: tabular-nums;
    }
    .cat-score { font-family: 'Inter', sans-serif; font-weight: 700; font-size: 22px; letter-spacing: -0.02em; }
    .cat-arrow { color: ${INK_FAINT}; font-size: 16px; }
    .cat-delta { font-size: 12px; font-weight: 600; }

    /* Footer */
    .report-footer { margin-top: 56px; padding-top: 22px; border-top: 1px solid ${PAPER_EDGE}; }
    .footer-brand {
      font-family: 'Inter', sans-serif; font-weight: 700; font-size: 14px;
      letter-spacing: -0.01em; color: ${INK};
    }
    .footer-note { font-size: 12px; color: ${INK_FAINT}; margin-top: 6px; }

    @media print {
      .fix-card, .category-section { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="container">

    <!-- Header -->
    <header class="report-header">
      <div class="section-tag header-tag">Fix Plan</div>
      ${logoHtml}
      <h1 class="header-site-name">${escapeHtml(plan.siteName)}</h1>
      <div class="header-url">${escapeHtml(plan.url)}</div>
      <div class="header-scores">
        <div class="score-cell">
          <span class="header-score" style="color: ${currentColor};">${plan.currentScore}</span>
          <span class="header-score-label">Today</span>
        </div>
        <span class="header-arrow">&rarr;</span>
        <div class="score-cell">
          <span class="header-score" style="color: ${projectedColor};">${plan.projectedScore}</span>
          <span class="header-score-label">After fixes</span>
        </div>
      </div>
      <div class="header-date">${escapeHtml(plan.auditDate)}</div>
    </header>

    ${quickWinsHtml}
    ${projectionHtml}

    <!-- Category Fix Plans -->
    <section class="section">
      <p class="section-tag">03 · Full plan</p>
      <h2 class="section-title">Broken down by area</h2>
      <p class="section-subtitle">Every fix grouped by category, with priority and effort tags.</p>
      ${categoriesHtml}
    </section>

    <!-- Footer -->
    <footer class="report-footer">
      <div class="footer-brand">niewdel</div>
      <div class="footer-note">Internal fix plan, ${escapeHtml(plan.siteName)} · ${escapeHtml(plan.auditDate)}</div>
    </footer>

  </div>
</body>
</html>`;
}
