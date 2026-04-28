import type { FixPlan, CategoryFixPlan, FixItem } from './fix-plan';

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
    case 'critical': return '#EF4444';
    case 'high': return '#F59E0B';
    case 'medium': return '#60A5FA';
    case 'low': return '#6B7280';
    default: return '#6B7280';
  }
}

function getDifficultyColor(difficulty: string): string {
  switch (difficulty) {
    case 'easy': return '#22C55E';
    case 'moderate': return '#F59E0B';
    case 'advanced': return '#EF4444';
    default: return '#6B7280';
  }
}

function getScoreColor(score: number): string {
  if (score <= 40) return '#EF4444';
  if (score <= 65) return '#F59E0B';
  if (score <= 85) return '#22C55E';
  return '#3B82F6';
}

function renderBadge(label: string, color: string): string {
  return `<span class="badge" style="background: ${color}20; color: ${color}; border: 1px solid ${color}50;">${escapeHtml(label)}</span>`;
}

function renderFixCard(fix: FixItem, index?: number): string {
  const numberHtml = index !== undefined
    ? `<span class="fix-number">${index + 1}</span>`
    : '';

  return `
    <div class="fix-card">
      <div class="fix-card-header">
        ${numberHtml}
        <div class="fix-badges">
          ${renderBadge(fix.priority, getPriorityColor(fix.priority))}
          ${renderBadge(fix.difficulty, getDifficultyColor(fix.difficulty))}
        </div>
      </div>
      <div class="fix-card-body">
        <div class="fix-problem">
          <span class="fix-label">Problem:</span>
          <span class="fix-problem-text">${escapeHtml(fix.finding)}</span>
        </div>
        <div class="fix-instruction">
          <span class="fix-label">Fix:</span>
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
    <section class="section quick-wins-section">
      <h2 class="section-title">Quick Wins &mdash; Start Here</h2>
      <p class="section-subtitle">The ${fixes.length} highest-impact, easiest fixes to implement first</p>
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
            <div class="projection-bar current-bar" style="width: ${cat.currentScore}%; background: ${currentColor}60;"></div>
            <div class="projection-bar target-bar" style="width: ${cat.targetScore}%; background: ${targetColor};"></div>
          </div>
          <div class="projection-scores">
            <span class="projection-current">${cat.currentScore}</span>
            <span class="projection-arrow">&#8594;</span>
            <span class="projection-target" style="color: ${targetColor};">${cat.targetScore}</span>
            <span class="projection-delta" style="color: ${targetColor};">+${delta}</span>
          </div>
        </div>
      </div>`;
  }).join('');

  return `
    <section class="section projection-section">
      <h2 class="section-title">Score Projection</h2>
      <p class="section-subtitle">Current scores vs. projected scores after all fixes are applied</p>
      <div class="projection-chart">${barsHtml}</div>
    </section>`;
}

function renderCategorySection(cat: CategoryFixPlan): string {
  const delta = cat.targetScore - cat.currentScore;
  const currentColor = getScoreColor(cat.currentScore);
  const targetColor = getScoreColor(cat.targetScore);
  const fixCount = cat.fixes.length;

  const fixesHtml = cat.fixes.map((fix) => renderFixCard(fix)).join('');

  return `
    <section class="section category-section" style="border-left: 4px solid ${targetColor};">
      <div class="category-header">
        <div class="category-title-area">
          <h2 class="category-name">${escapeHtml(cat.category_name)}</h2>
          <span class="fix-count">${fixCount} fix${fixCount !== 1 ? 'es' : ''}</span>
        </div>
        <div class="category-score-area">
          <span class="cat-score current" style="color: ${currentColor};">${cat.currentScore}</span>
          <span class="cat-arrow">&#8594;</span>
          <span class="cat-score target" style="color: ${targetColor};">${cat.targetScore}</span>
          <span class="cat-delta" style="color: ${targetColor};">+${delta}</span>
        </div>
      </div>
      <div class="fix-cards">${fixesHtml}</div>
    </section>`;
}

export function generateFixPlanHtml(plan: FixPlan, logoDataUri?: string): string {
  const currentScoreColor = getScoreColor(plan.currentScore);
  const projectedScoreColor = getScoreColor(plan.projectedScore);

  const logoHtml = logoDataUri
    ? `<img src="${logoDataUri}" alt="Niewdel" class="header-logo" />`
    : `<span class="header-logo-text">NIEWDEL</span>`;

  const footerLogoHtml = logoDataUri
    ? `<img src="${logoDataUri}" alt="Niewdel" class="footer-logo" />`
    : `<span class="footer-logo-text">NIEWDEL</span>`;

  const quickWinsHtml = renderQuickWins(plan.quickWins);
  const projectionHtml = renderScoreProjection(plan.categories);
  const categoriesHtml = plan.categories.map((cat) => renderCategorySection(cat)).join('');

  const formattedDate = plan.auditDate;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Fix Plan — ${escapeHtml(plan.siteName)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Montserrat:wght@400;600;700&display=swap" rel="stylesheet" />
  <style>
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: #0D0D0D;
      color: #F5F5F5;
      line-height: 1.6;
      -webkit-font-smoothing: antialiased;
    }

    .container {
      max-width: 940px;
      margin: 0 auto;
      padding: 40px 24px;
    }

    /* Header */
    .report-header {
      text-align: center;
      padding-bottom: 40px;
      border-bottom: 1px solid #222;
      margin-bottom: 40px;
    }

    .header-logo {
      height: 32px;
      margin-bottom: 16px;
    }

    .header-logo-text {
      font-family: 'Montserrat', sans-serif;
      font-weight: 700;
      font-size: 28px;
      letter-spacing: 6px;
      color: #F5F5F5;
      display: block;
      margin-bottom: 16px;
    }

    .header-subtitle {
      font-family: 'Montserrat', sans-serif;
      font-weight: 600;
      font-size: 14px;
      letter-spacing: 4px;
      text-transform: uppercase;
      color: #00B4D8;
      margin-bottom: 24px;
    }

    .header-site-name {
      font-family: 'Montserrat', sans-serif;
      font-weight: 700;
      font-size: 24px;
      color: #F5F5F5;
      margin-bottom: 4px;
    }

    .header-url {
      font-size: 14px;
      color: #888;
      margin-bottom: 20px;
    }

    .header-scores {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 16px;
      margin-bottom: 12px;
    }

    .header-score {
      font-family: 'Montserrat', sans-serif;
      font-weight: 700;
      font-size: 48px;
    }

    .header-score-arrow {
      font-size: 32px;
      color: #555;
    }

    .header-score-label {
      font-size: 12px;
      color: #888;
      text-transform: uppercase;
      letter-spacing: 2px;
    }

    .header-date {
      font-size: 13px;
      color: #666;
      margin-top: 12px;
    }

    /* Section shared */
    .section {
      margin-bottom: 48px;
    }

    .section-title {
      font-family: 'Montserrat', sans-serif;
      font-weight: 700;
      font-size: 22px;
      color: #F5F5F5;
      margin-bottom: 6px;
    }

    .section-subtitle {
      font-size: 14px;
      color: #888;
      margin-bottom: 24px;
    }

    /* Fix Cards */
    .fix-cards {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .fix-card {
      background: #111;
      border: 1px solid #222;
      border-radius: 8px;
      padding: 20px;
    }

    .fix-card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 14px;
    }

    .fix-number {
      font-family: 'Montserrat', sans-serif;
      font-weight: 700;
      font-size: 20px;
      color: #00B4D8;
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 2px solid #00B4D8;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .fix-badges {
      display: flex;
      gap: 8px;
    }

    .badge {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 3px 10px;
      border-radius: 100px;
      white-space: nowrap;
    }

    .fix-card-body {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .fix-label {
      font-weight: 600;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #888;
      margin-right: 8px;
      flex-shrink: 0;
    }

    .fix-problem {
      display: flex;
      align-items: baseline;
    }

    .fix-problem-text {
      color: #EF4444;
      font-size: 14px;
    }

    .fix-instruction {
      display: flex;
      align-items: baseline;
    }

    .fix-instruction-text {
      color: #E5E5E5;
      font-size: 14px;
    }

    .fix-meta {
      display: flex;
      gap: 20px;
      margin-top: 4px;
    }

    .fix-meta-item {
      font-size: 13px;
      color: #999;
    }

    /* Score Projection */
    .projection-chart {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .projection-row {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .projection-label {
      width: 200px;
      flex-shrink: 0;
      font-size: 13px;
      font-weight: 500;
      color: #CCC;
      text-align: right;
    }

    .projection-bars {
      flex: 1;
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .projection-bar-track {
      flex: 1;
      height: 24px;
      background: #1A1A1A;
      border-radius: 4px;
      position: relative;
      overflow: hidden;
    }

    .projection-bar {
      position: absolute;
      top: 0;
      left: 0;
      height: 100%;
      border-radius: 4px;
      transition: width 0.3s;
    }

    .current-bar {
      z-index: 1;
    }

    .target-bar {
      z-index: 0;
      opacity: 0.35;
    }

    .projection-scores {
      display: flex;
      align-items: center;
      gap: 6px;
      width: 150px;
      flex-shrink: 0;
      font-size: 14px;
    }

    .projection-current {
      color: #888;
      font-weight: 600;
      font-family: 'Montserrat', sans-serif;
    }

    .projection-arrow {
      color: #555;
      font-size: 12px;
    }

    .projection-target {
      font-weight: 700;
      font-family: 'Montserrat', sans-serif;
    }

    .projection-delta {
      font-size: 12px;
      font-weight: 600;
      margin-left: 4px;
    }

    /* Category Sections */
    .category-section {
      padding-left: 20px;
    }

    .category-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 20px;
    }

    .category-title-area {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .category-name {
      font-family: 'Montserrat', sans-serif;
      font-weight: 700;
      font-size: 18px;
      color: #F5F5F5;
    }

    .fix-count {
      font-size: 12px;
      color: #888;
      background: #1A1A1A;
      padding: 2px 10px;
      border-radius: 100px;
    }

    .category-score-area {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .cat-score {
      font-family: 'Montserrat', sans-serif;
      font-weight: 700;
      font-size: 22px;
    }

    .cat-arrow {
      color: #555;
      font-size: 16px;
    }

    .cat-delta {
      font-size: 13px;
      font-weight: 600;
    }

    /* Footer */
    .report-footer {
      margin-top: 60px;
      padding-top: 24px;
      border-top: 1px solid #222;
      text-align: center;
    }

    .footer-logo {
      height: 20px;
      opacity: 0.4;
      margin-bottom: 8px;
    }

    .footer-logo-text {
      font-family: 'Montserrat', sans-serif;
      font-weight: 700;
      font-size: 14px;
      letter-spacing: 4px;
      color: #F5F5F5;
      opacity: 0.4;
      display: block;
      margin-bottom: 8px;
    }

    .footer-note {
      font-size: 12px;
      color: #555;
    }

    /* Print */
    @media print {
      body {
        background: #fff;
        color: #111;
      }

      .container {
        max-width: 100%;
        padding: 20px;
      }

      .fix-card {
        background: #f9f9f9;
        border-color: #ddd;
        break-inside: avoid;
      }

      .fix-problem-text {
        color: #B91C1C;
      }

      .fix-instruction-text {
        color: #111;
      }

      .header-logo-text,
      .header-site-name,
      .category-name,
      .section-title {
        color: #111;
      }

      .projection-bar-track {
        background: #eee;
      }

      .report-footer {
        border-top-color: #ddd;
      }

      .footer-logo-text {
        color: #111;
      }
    }
  </style>
</head>
<body>
  <div class="container">

    <!-- Header -->
    <header class="report-header">
      ${logoHtml}
      <div class="header-subtitle">WEBSITE FIX PLAN</div>
      <div class="header-site-name">${escapeHtml(plan.siteName)}</div>
      <div class="header-url">${escapeHtml(plan.url)}</div>
      <div class="header-scores">
        <div style="text-align: center;">
          <div class="header-score" style="color: ${currentScoreColor};">${plan.currentScore}</div>
          <div class="header-score-label">Current</div>
        </div>
        <div class="header-score-arrow">&#8594;</div>
        <div style="text-align: center;">
          <div class="header-score" style="color: ${projectedScoreColor};">${plan.projectedScore}</div>
          <div class="header-score-label">Projected</div>
        </div>
      </div>
      <div class="header-date">${escapeHtml(formattedDate)}</div>
    </header>

    <!-- Quick Wins -->
    ${quickWinsHtml}

    <!-- Score Projection -->
    ${projectionHtml}

    <!-- Category Fix Plans -->
    ${categoriesHtml}

    <!-- Footer -->
    <footer class="report-footer">
      ${footerLogoHtml}
      <div class="footer-note">Internal use only &mdash; Fix plan for ${escapeHtml(plan.siteName)}</div>
    </footer>

  </div>
</body>
</html>`;
}
