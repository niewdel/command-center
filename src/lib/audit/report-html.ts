import type { AuditResult, CategoryResult, PSIMetrics } from './types';

function getScoreColor(score: number): string {
  if (score <= 40) return '#EF4444';
  if (score <= 65) return '#F59E0B';
  if (score <= 85) return '#22C55E';
  return '#3B82F6';
}

function getScoreLabel(score: number): string {
  if (score <= 40) return 'Critical';
  if (score <= 65) return 'Needs Work';
  if (score <= 85) return 'Acceptable';
  return 'Excellent';
}

function getSeverityIcon(score: number): string {
  if (score <= 40) return '&#9888;';  // warning triangle
  if (score <= 65) return '&#9679;';  // filled circle
  return '&#10003;'; // checkmark
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatMs(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms)}ms`;
}

function getCwvStatus(metric: string, value: number): { label: string; color: string } {
  const thresholds: Record<string, [number, number]> = {
    lcp: [2500, 4000],
    fcp: [1800, 3000],
    tbt: [200, 600],
    speedIndex: [3400, 5800],
    cls: [0.1, 0.25],
  };
  const [good, poor] = thresholds[metric] || [0, 0];
  if (value <= good) return { label: 'Good', color: '#22C55E' };
  if (value <= poor) return { label: 'Needs Improvement', color: '#F59E0B' };
  return { label: 'Poor', color: '#EF4444' };
}

function renderCategorySection(cat: CategoryResult, index: number): string {
  const color = getScoreColor(cat.score);
  const label = getScoreLabel(cat.score);
  const icon = getSeverityIcon(cat.score);
  const issueCount = cat.findings.length;
  const categoryNumber = String(index + 1).padStart(2, '0');

  const findingsHtml = cat.findings
    .map((f) => {
      const bulletColor = '#EF4444';
      const bulletIcon = '&#10007;';
      return `
      <li class="finding-item">
        <span class="finding-icon" style="color: ${bulletColor};">${bulletIcon}</span>
        <span class="finding-text">${escapeHtml(f)}</span>
      </li>`;
    })
    .join('');

  return `
    <section class="category-section" style="border-left: 4px solid ${color};">
      <div class="category-header">
        <div class="category-meta">
          <span class="category-number">${categoryNumber}</span>
          <h2 class="category-name">${escapeHtml(cat.category_name)}</h2>
        </div>
        <div class="category-score-area">
          <div class="score-badge-lg" style="background: ${color}15; border: 2px solid ${color};">
            <span class="score-badge-number" style="color: ${color};">${cat.score}</span>
            <span class="score-badge-max" style="color: ${color}80;">/100</span>
          </div>
          <span class="severity-label" style="color: ${color};">${icon} ${label}</span>
        </div>
      </div>
      <div class="category-body">
        <p class="category-headline" style="color: ${color};">${escapeHtml(cat.headline)}</p>
        <p class="category-narrative">${escapeHtml(cat.narrative)}</p>
        ${issueCount > 0 ? `
          <div class="findings-header">
            <span class="findings-count">${issueCount} finding${issueCount !== 1 ? 's' : ''} identified</span>
          </div>
          <ul class="findings-list">${findingsHtml}</ul>
        ` : ''}
      </div>
    </section>`;
}

function renderScoreBar(cat: CategoryResult): string {
  const color = getScoreColor(cat.score);
  const label = getScoreLabel(cat.score);
  return `
    <div class="score-bar-row">
      <div class="score-bar-label">${escapeHtml(cat.category_name)}</div>
      <div class="score-bar-track">
        <div class="score-bar-fill" style="width: ${cat.score}%; background: linear-gradient(90deg, ${color}CC, ${color});"></div>
      </div>
      <div class="score-bar-value" style="color: ${color};">${cat.score}</div>
      <div class="score-bar-status" style="color: ${color};">${label}</div>
    </div>`;
}

function renderCwvMetric(label: string, key: string, value: number, unit: string): string {
  const status = getCwvStatus(key, value);
  const displayValue = key === 'cls' ? value.toFixed(3) : formatMs(value);
  return `
    <div class="cwv-metric">
      <div class="cwv-value" style="color: ${status.color};">${displayValue}</div>
      <div class="cwv-label">${label}</div>
      <div class="cwv-status" style="color: ${status.color}; background: ${status.color}15;">${status.label}</div>
      <div class="cwv-target">Target: ${unit}</div>
    </div>`;
}

function renderPerformanceDashboard(psiMetrics: PSIMetrics[]): string {
  if (!psiMetrics || psiMetrics.length === 0) {
    return `
      <section class="perf-dashboard">
        <h2 class="section-title">Performance Dashboard</h2>
        <p class="section-subtitle">Core Web Vitals &amp; speed metrics</p>
        <div class="perf-unavailable">
          <span class="perf-unavailable-icon">&#9888;</span>
          <p>Performance data could not be retrieved for this site. This may indicate server issues or extremely slow load times.</p>
        </div>
      </section>`;
  }

  // Average all metrics
  const avg = {
    performance: Math.round(psiMetrics.reduce((s, m) => s + m.scores.performance, 0) / psiMetrics.length),
    lcp: psiMetrics.reduce((s, m) => s + m.coreWebVitals.lcp, 0) / psiMetrics.length,
    fcp: psiMetrics.reduce((s, m) => s + m.coreWebVitals.fcp, 0) / psiMetrics.length,
    cls: psiMetrics.reduce((s, m) => s + m.coreWebVitals.cls, 0) / psiMetrics.length,
    tbt: psiMetrics.reduce((s, m) => s + m.coreWebVitals.tbt, 0) / psiMetrics.length,
    speedIndex: psiMetrics.reduce((s, m) => s + m.coreWebVitals.speedIndex, 0) / psiMetrics.length,
  };

  const perfColor = getScoreColor(avg.performance);

  // Per-page scores
  const pageScoresHtml = psiMetrics.map((m) => {
    const color = getScoreColor(m.scores.performance);
    const pathname = new URL(m.url).pathname || '/';
    return `
      <div class="page-score-row">
        <span class="page-score-path">${escapeHtml(pathname)}</span>
        <div class="page-score-bar-track">
          <div class="page-score-bar-fill" style="width: ${m.scores.performance}%; background: ${color};"></div>
        </div>
        <span class="page-score-value" style="color: ${color};">${m.scores.performance}</span>
      </div>`;
  }).join('');

  return `
    <section class="perf-dashboard">
      <h2 class="section-title">Performance Dashboard</h2>
      <p class="section-subtitle">Core Web Vitals &amp; speed metrics from Google PageSpeed Insights</p>

      <div class="perf-overview">
        <div class="perf-score-ring" style="border-color: ${perfColor}; box-shadow: 0 0 30px ${perfColor}22;">
          <span class="perf-score-number" style="color: ${perfColor};">${avg.performance}</span>
          <span class="perf-score-unit">avg</span>
        </div>
        <div class="perf-cwv-grid">
          ${renderCwvMetric('Largest Contentful Paint', 'lcp', avg.lcp, '< 2.5s')}
          ${renderCwvMetric('First Contentful Paint', 'fcp', avg.fcp, '< 1.8s')}
          ${renderCwvMetric('Cumulative Layout Shift', 'cls', avg.cls, '< 0.1')}
          ${renderCwvMetric('Total Blocking Time', 'tbt', avg.tbt, '< 200ms')}
          ${renderCwvMetric('Speed Index', 'speedIndex', avg.speedIndex, '< 3.4s')}
        </div>
      </div>

      <div class="page-scores">
        <h3 class="subsection-title">Page-by-Page Performance</h3>
        ${pageScoresHtml}
      </div>
    </section>`;
}

function renderScreenshots(screenshots: { url: string; dataUri: string }[]): string {
  if (!screenshots || screenshots.length === 0) return '';

  const items = screenshots
    .map((s) => {
      const pathname = (() => { try { return new URL(s.url).pathname || '/'; } catch { return s.url; } })();
      return `
      <div class="screenshot-item">
        <div class="screenshot-label">${escapeHtml(pathname)}</div>
        <img src="${s.dataUri}" alt="Screenshot of ${escapeHtml(s.url)}" class="screenshot-img" />
        <p class="screenshot-caption">${escapeHtml(s.url)}</p>
      </div>`;
    })
    .join('');

  return `
    <section class="screenshots-section">
      <h2 class="section-title">Visual Preview</h2>
      <p class="section-subtitle">Screenshots captured during the audit</p>
      <div class="screenshots-grid">
        ${items}
      </div>
    </section>`;
}

function renderStatsBar(result: AuditResult): string {
  const totalFindings = result.categories.reduce((s, c) => s + c.findings.length, 0);
  const criticalCategories = result.categories.filter(c => c.score <= 40).length;
  const seriousCategories = result.categories.filter(c => c.score > 40 && c.score <= 65).length;

  return `
    <div class="stats-bar">
      <div class="stat-item">
        <div class="stat-number">${result.pagesCrawled}</div>
        <div class="stat-label">Pages Analyzed</div>
      </div>
      <div class="stat-divider"></div>
      <div class="stat-item">
        <div class="stat-number">${result.psiMetrics.length}</div>
        <div class="stat-label">Speed Tests Run</div>
      </div>
      <div class="stat-divider"></div>
      <div class="stat-item">
        <div class="stat-number" style="color: #F59E0B;">${totalFindings}</div>
        <div class="stat-label">Issues Found</div>
      </div>
      <div class="stat-divider"></div>
      <div class="stat-item">
        <div class="stat-number" style="color: #EF4444;">${criticalCategories}</div>
        <div class="stat-label">Critical Areas</div>
      </div>
      <div class="stat-divider"></div>
      <div class="stat-item">
        <div class="stat-number" style="color: #F59E0B;">${seriousCategories}</div>
        <div class="stat-label">Areas Needing Work</div>
      </div>
    </div>`;
}

function renderAlertBanner(result: AuditResult): string {
  if (result.overall_score > 65) return '';

  const isCritical = result.overall_score <= 40;
  const bgColor = isCritical ? '#EF444415' : '#F59E0B12';
  const borderColor = isCritical ? '#EF4444' : '#F59E0B';
  const icon = isCritical ? '&#9888;' : '&#9888;';
  const title = isCritical
    ? 'Critical Issues Detected'
    : 'Significant Issues Detected';
  const message = isCritical
    ? 'This website has critical deficiencies that are actively costing the business customers and revenue. Immediate action is recommended.'
    : 'This website has multiple areas that fall below industry standards. These issues are likely impacting customer acquisition and credibility.';

  return `
    <div class="alert-banner" style="background: ${bgColor}; border: 1px solid ${borderColor}40; border-left: 4px solid ${borderColor};">
      <div class="alert-icon" style="color: ${borderColor};">${icon}</div>
      <div class="alert-content">
        <div class="alert-title" style="color: ${borderColor};">${title}</div>
        <p class="alert-message">${message}</p>
      </div>
    </div>`;
}

export function generateHtmlReport(result: AuditResult, logoDataUri?: string): string {
  const overallColor = getScoreColor(result.overall_score);
  const overallLabel = getScoreLabel(result.overall_score);

  const scoreBarsHtml = result.categories.map(renderScoreBar).join('');
  const categorySectionsHtml = result.categories
    .map((cat, i) => renderCategorySection(cat, i))
    .join('');
  const screenshotsHtml = ''; // Disabled until annotated screenshots are implemented
  const perfDashboardHtml = renderPerformanceDashboard(result.psiMetrics);
  const statsBarHtml = renderStatsBar(result);
  const alertBannerHtml = renderAlertBanner(result);

  const totalFindings = result.categories.reduce((s, c) => s + c.findings.length, 0);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Website Audit Report — ${escapeHtml(result.siteName)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Montserrat:wght@400;600;700;800;900&display=swap" rel="stylesheet" />
  <style>
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: #0D0D0D;
      color: #F5F5F5;
      line-height: 1.7;
      -webkit-font-smoothing: antialiased;
    }

    .container { max-width: 940px; margin: 0 auto; padding: 0 36px; }

    /* ── Cover ─────────────────────────────────────────── */

    .cover {
      min-height: 100vh;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      text-align: center; padding: 80px 32px;
      background: linear-gradient(180deg, #0D0D0D 0%, #111 40%, #0D0D0D 100%);
      position: relative; overflow: hidden;
    }
    .cover::before {
      content: ''; position: absolute; top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      width: 700px; height: 700px;
      background: radial-gradient(circle, ${overallColor}08 0%, transparent 70%);
      pointer-events: none;
    }
    .cover-logo { margin-bottom: 20px; position: relative; }
    .cover-logo img { height: 52px; width: auto; display: block; }
    .cover-subtitle {
      font-family: 'Montserrat', sans-serif; font-weight: 600; font-size: 13px;
      letter-spacing: 8px; color: #00B4D8; text-transform: uppercase;
      margin-bottom: 60px; position: relative;
    }
    .cover-score-ring {
      width: 220px; height: 220px; border-radius: 50%;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      margin-bottom: 48px; position: relative; background: #111;
      border: 3px solid ${overallColor};
      box-shadow: 0 0 60px ${overallColor}25, 0 0 120px ${overallColor}10, inset 0 0 40px rgba(0,0,0,0.6);
    }
    .cover-score-number {
      font-family: 'Montserrat', sans-serif; font-weight: 900; font-size: 80px;
      color: ${overallColor}; line-height: 1;
    }
    .cover-score-of {
      font-family: 'Inter', sans-serif; font-weight: 400; font-size: 16px;
      color: ${overallColor}80; margin-top: 2px;
    }
    .cover-score-label {
      font-family: 'Montserrat', sans-serif; font-weight: 700; font-size: 14px;
      letter-spacing: 4px; text-transform: uppercase; color: ${overallColor};
      margin-top: 24px; padding: 6px 20px; border: 1px solid ${overallColor}40;
      border-radius: 20px;
    }
    .cover-site-name {
      font-family: 'Montserrat', sans-serif; font-weight: 700; font-size: 30px;
      color: #F5F5F5; margin-top: 32px; position: relative;
    }
    .cover-url { font-size: 14px; color: #6b7280; margin-top: 8px; word-break: break-all; position: relative; }
    .cover-date { font-size: 13px; color: #4b5563; margin-top: 4px; position: relative; }

    /* ── Stats Bar ─────────────────────────────────────── */

    .stats-bar {
      display: flex; justify-content: center; align-items: center; gap: 0;
      padding: 28px 0; margin: 0 -36px;
      background: #111; border-top: 1px solid #1f2937; border-bottom: 1px solid #1f2937;
    }
    .stat-item { text-align: center; padding: 0 32px; }
    .stat-number {
      font-family: 'Montserrat', sans-serif; font-weight: 800; font-size: 28px; color: #F5F5F5;
    }
    .stat-label { font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 1.5px; margin-top: 4px; }
    .stat-divider { width: 1px; height: 40px; background: #1f2937; }

    /* ── Alert Banner ──────────────────────────────────── */

    .alert-banner {
      display: flex; align-items: flex-start; gap: 16px;
      padding: 20px 24px; border-radius: 10px; margin: 40px 0 0;
    }
    .alert-icon { font-size: 24px; flex-shrink: 0; margin-top: 2px; }
    .alert-title { font-family: 'Montserrat', sans-serif; font-weight: 700; font-size: 15px; margin-bottom: 4px; }
    .alert-message { font-size: 13px; color: #9ca3af; line-height: 1.7; }

    /* ── Dividers ──────────────────────────────────────── */

    .divider-thin { width: 100%; height: 1px; background: linear-gradient(90deg, transparent, #1f2937, transparent); margin: 48px 0; }
    .section-divider { width: 100%; height: 1px; background: #1f2937; margin: 56px 0; }

    /* ── Section Titles ────────────────────────────────── */

    .section-title {
      font-family: 'Montserrat', sans-serif; font-weight: 700; font-size: 26px;
      color: #F5F5F5; margin-bottom: 6px; letter-spacing: 0.3px;
    }
    .section-subtitle { font-size: 14px; color: #6b7280; margin-bottom: 36px; }
    .subsection-title {
      font-family: 'Montserrat', sans-serif; font-weight: 600; font-size: 14px;
      color: #9ca3af; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 16px; margin-top: 32px;
    }

    /* ── Executive Summary ─────────────────────────────── */

    .executive { padding: 56px 0 0; }
    .overall-headline {
      font-family: 'Montserrat', sans-serif; font-weight: 700; font-size: 22px;
      color: ${overallColor}; margin-bottom: 16px; line-height: 1.4;
    }
    .overall-narrative { font-size: 15px; color: #d1d5db; line-height: 1.9; margin-bottom: 48px; }

    /* ── Score Bars ────────────────────────────────────── */

    .score-bars { margin-bottom: 16px; }
    .score-bar-row { display: flex; align-items: center; margin-bottom: 14px; }
    .score-bar-label {
      width: 190px; flex-shrink: 0; font-size: 13px; font-weight: 500;
      color: #9ca3af; text-align: right; padding-right: 20px;
    }
    .score-bar-track { flex: 1; height: 12px; background: #1a1a1a; border-radius: 6px; overflow: hidden; border: 1px solid #252525; }
    .score-bar-fill { height: 100%; border-radius: 6px; }
    .score-bar-value {
      width: 36px; flex-shrink: 0; text-align: right;
      font-family: 'Montserrat', sans-serif; font-weight: 800; font-size: 15px; padding-left: 14px;
    }
    .score-bar-status {
      width: 100px; flex-shrink: 0; text-align: right;
      font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; padding-left: 12px;
    }

    /* ── Performance Dashboard ─────────────────────────── */

    .perf-dashboard { padding: 0; }
    .perf-overview { display: flex; align-items: flex-start; gap: 40px; margin-bottom: 16px; }
    .perf-score-ring {
      width: 120px; height: 120px; border-radius: 50%; flex-shrink: 0;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      background: #111; border: 3px solid;
    }
    .perf-score-number { font-family: 'Montserrat', sans-serif; font-weight: 900; font-size: 36px; line-height: 1; }
    .perf-score-unit { font-size: 11px; color: #6b7280; margin-top: 2px; }
    .perf-cwv-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; flex: 1; }
    .cwv-metric {
      background: #111; border: 1px solid #1f2937; border-radius: 10px; padding: 16px; text-align: center;
    }
    .cwv-value { font-family: 'Montserrat', sans-serif; font-weight: 800; font-size: 22px; }
    .cwv-label { font-size: 11px; color: #6b7280; margin-top: 4px; line-height: 1.3; }
    .cwv-status {
      display: inline-block; font-size: 10px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 1px; padding: 3px 10px; border-radius: 12px; margin-top: 8px;
    }
    .cwv-target { font-size: 10px; color: #4b5563; margin-top: 6px; }

    .page-scores { margin-top: 8px; }
    .page-score-row { display: flex; align-items: center; margin-bottom: 10px; }
    .page-score-path { width: 200px; flex-shrink: 0; font-size: 12px; color: #6b7280; font-family: monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .page-score-bar-track { flex: 1; height: 8px; background: #1a1a1a; border-radius: 4px; overflow: hidden; border: 1px solid #252525; }
    .page-score-bar-fill { height: 100%; border-radius: 4px; }
    .page-score-value { width: 40px; flex-shrink: 0; text-align: right; font-family: 'Montserrat', sans-serif; font-weight: 700; font-size: 13px; padding-left: 12px; }

    .perf-unavailable {
      display: flex; align-items: center; gap: 16px;
      background: #EF444410; border: 1px solid #EF444430; border-radius: 10px; padding: 24px;
    }
    .perf-unavailable-icon { font-size: 28px; color: #EF4444; flex-shrink: 0; }
    .perf-unavailable p { font-size: 14px; color: #9ca3af; }

    /* ── Category Deep-Dives ───────────────────────────── */

    .categories { padding: 0 0 20px; }
    .category-section {
      background: #111; border: 1px solid #1f2937;
      border-radius: 12px; padding: 32px 36px; margin-bottom: 24px;
      border-left: 4px solid;
    }
    .category-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 24px; }
    .category-meta { display: flex; align-items: center; gap: 14px; }
    .category-number {
      font-family: 'Montserrat', sans-serif; font-weight: 800; font-size: 13px;
      color: #374151; background: #1a1a1a; width: 32px; height: 32px;
      border-radius: 8px; display: flex; align-items: center; justify-content: center;
    }
    .category-name { font-family: 'Montserrat', sans-serif; font-weight: 700; font-size: 19px; color: #F5F5F5; }
    .category-score-area { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; flex-shrink: 0; }
    .score-badge-lg {
      display: flex; align-items: baseline; gap: 2px; padding: 8px 16px;
      border-radius: 10px; border: 2px solid;
    }
    .score-badge-number { font-family: 'Montserrat', sans-serif; font-weight: 900; font-size: 28px; }
    .score-badge-max { font-family: 'Inter', sans-serif; font-weight: 400; font-size: 14px; }
    .severity-label { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; }

    .category-body {}
    .category-headline {
      font-family: 'Montserrat', sans-serif; font-weight: 700; font-size: 16px;
      margin-bottom: 10px; line-height: 1.4;
    }
    .category-narrative { font-size: 14px; color: #9ca3af; line-height: 1.8; margin-bottom: 24px; }

    .findings-header { margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px solid #1f2937; }
    .findings-count {
      font-family: 'Montserrat', sans-serif; font-weight: 600; font-size: 12px;
      color: #6b7280; text-transform: uppercase; letter-spacing: 1.5px;
    }
    .findings-list { list-style: none; padding: 0; }
    .finding-item {
      display: flex; align-items: flex-start; gap: 10px;
      padding: 8px 0; font-size: 13px; color: #d1d5db; line-height: 1.5;
      border-bottom: 1px solid #1a1a1a;
    }
    .finding-item:last-child { border-bottom: none; }
    .finding-icon { font-size: 14px; flex-shrink: 0; margin-top: 1px; font-weight: 700; }
    .finding-text { flex: 1; }

    /* ── Screenshots ───────────────────────────────────── */

    .screenshots-section { padding: 0 0 20px; }
    .screenshots-grid { display: flex; flex-direction: column; gap: 24px; margin-top: 24px; }
    .screenshot-item { background: #111; border: 1px solid #1f2937; border-radius: 12px; overflow: hidden; }
    .screenshot-label {
      padding: 10px 20px; font-family: monospace; font-size: 13px; color: #00B4D8;
      background: #0a0a0a; border-bottom: 1px solid #1f2937;
    }
    .screenshot-img { width: 100%; display: block; }
    .screenshot-caption {
      padding: 10px 20px; font-size: 11px; color: #4b5563; word-break: break-all;
      border-top: 1px solid #1f2937;
    }

    /* ── Bottom CTA ────────────────────────────────────── */

    .bottom-cta {
      text-align: center; padding: 56px 0; margin-top: 20px;
      background: linear-gradient(180deg, transparent, #00B4D808, transparent);
      border-radius: 16px;
    }
    .bottom-cta-title {
      font-family: 'Montserrat', sans-serif; font-weight: 700; font-size: 22px; color: #F5F5F5; margin-bottom: 12px;
    }
    .bottom-cta-text { font-size: 14px; color: #6b7280; max-width: 500px; margin: 0 auto 24px; line-height: 1.7; }
    .bottom-cta-contact {
      font-family: 'Montserrat', sans-serif; font-weight: 700; font-size: 16px;
      color: #00B4D8; letter-spacing: 1px;
    }

    /* ── Legend / Footer ───────────────────────────────── */

    .legend { padding: 40px 0; }
    .legend-title {
      font-family: 'Montserrat', sans-serif; font-weight: 600; font-size: 12px;
      letter-spacing: 3px; text-transform: uppercase; color: #4b5563; margin-bottom: 16px;
    }
    .legend-items { display: flex; gap: 28px; flex-wrap: wrap; }
    .legend-item { display: flex; align-items: center; gap: 8px; }
    .legend-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
    .legend-text { font-size: 12px; color: #6b7280; }
    .legend-range { font-family: 'Montserrat', sans-serif; font-weight: 600; font-size: 11px; color: #4b5563; }

    .footer { text-align: center; padding: 36px 0; border-top: 1px solid #1f2937; }
    .footer-brand {
      font-family: 'Montserrat', sans-serif; font-weight: 700; font-size: 13px;
      letter-spacing: 6px; color: #2a2a2a; text-transform: uppercase;
    }
    .footer-tagline { font-size: 12px; color: #2a2a2a; margin-top: 6px; }

    /* ── Print ─────────────────────────────────────────── */

    @media print {
      body { background: #fff; color: #111; }
      .cover { min-height: auto; padding: 60px 32px; background: #fff; page-break-after: always; }
      .cover::before { display: none; }
      .cover-site-name, .section-title, .category-name, .category-headline { color: #111; }
      .overall-narrative, .category-narrative { color: #374151; }
      .stats-bar { background: #f9fafb; border-color: #e5e7eb; }
      .stat-number { color: #111; }
      .category-section { background: #f9fafb; border-color: #e5e7eb; page-break-inside: avoid; }
      .cwv-metric { background: #f9fafb; border-color: #e5e7eb; }
      .score-bar-track, .page-score-bar-track { background: #e5e7eb; border-color: #ddd; }
      .finding-item { border-color: #e5e7eb; color: #374151; }
      .screenshot-item { border-color: #e5e7eb; page-break-inside: avoid; }
      .footer { border-color: #e5e7eb; }
    }
  </style>
</head>
<body>

  <!-- Cover -->
  <div class="cover">
    <div class="cover-logo">${logoDataUri ? `<img src="${logoDataUri}" alt="Niewdel" />` : `<span style="font-family:'Montserrat',sans-serif;font-weight:900;font-size:48px;letter-spacing:16px;color:#F5F5F5;text-transform:uppercase;">NIEWDEL</span>`}</div>
    <div class="cover-subtitle">Website Audit Report</div>
    <div class="cover-score-ring">
      <div class="cover-score-number">${result.overall_score}</div>
      <div class="cover-score-of">out of 100</div>
    </div>
    <div class="cover-score-label" style="color: ${overallColor}; border-color: ${overallColor}40;">${overallLabel}</div>
    <div class="cover-site-name">${escapeHtml(result.siteName)}</div>
    <div class="cover-url">${escapeHtml(result.url)}</div>
    <div class="cover-date">${escapeHtml(result.auditDate)} &middot; ${result.pagesCrawled} page${result.pagesCrawled !== 1 ? 's' : ''} analyzed</div>
  </div>

  <!-- Stats Bar -->
  <div class="container">
    ${statsBarHtml}
    ${alertBannerHtml}

    <!-- Executive Summary -->
    <section class="executive">
      <h1 class="section-title">Executive Summary</h1>
      <p class="section-subtitle">Your website scored ${result.overall_score} out of 100 across 8 audit categories. ${totalFindings} issues were identified.</p>
      <p class="overall-headline">${escapeHtml(result.overall_headline)}</p>
      <p class="overall-narrative">${escapeHtml(result.overall_narrative)}</p>

      <div class="score-bars">
        ${scoreBarsHtml}
      </div>
    </section>

    <div class="section-divider"></div>

    <!-- Performance Dashboard -->
    ${perfDashboardHtml}

    <div class="section-divider"></div>

    <!-- Category Deep-Dives -->
    <section class="categories">
      <h2 class="section-title">Detailed Findings</h2>
      <p class="section-subtitle">Category-by-category breakdown with ${totalFindings} individual findings</p>
      <div style="margin-top: 28px;">
        ${categorySectionsHtml}
      </div>
    </section>

    <div class="section-divider"></div>

    <!-- Screenshots -->
    ${screenshotsHtml}

    ${screenshotsHtml ? '<div class="section-divider"></div>' : ''}

    <!-- Bottom CTA -->
    <div class="bottom-cta">
      <div class="bottom-cta-title">Ready to improve these scores?</div>
      <p class="bottom-cta-text">This audit identified ${totalFindings} areas where your website is underperforming. A targeted improvement plan can address the most impactful issues first.</p>
      <div class="bottom-cta-contact">niewdel.com</div>
    </div>

    <div class="section-divider"></div>

    <!-- Legend -->
    <section class="legend">
      <p class="legend-title">Scoring Legend</p>
      <div class="legend-items">
        <div class="legend-item">
          <div class="legend-dot" style="background: #EF4444;"></div>
          <span class="legend-text">Critical</span>
          <span class="legend-range">(0 &ndash; 40)</span>
        </div>
        <div class="legend-item">
          <div class="legend-dot" style="background: #F59E0B;"></div>
          <span class="legend-text">Needs Work</span>
          <span class="legend-range">(41 &ndash; 65)</span>
        </div>
        <div class="legend-item">
          <div class="legend-dot" style="background: #22C55E;"></div>
          <span class="legend-text">Acceptable</span>
          <span class="legend-range">(66 &ndash; 85)</span>
        </div>
        <div class="legend-item">
          <div class="legend-dot" style="background: #3B82F6;"></div>
          <span class="legend-text">Excellent</span>
          <span class="legend-range">(86 &ndash; 100)</span>
        </div>
      </div>
    </section>

    <!-- Footer -->
    <div class="footer">
      ${logoDataUri ? `<img src="${logoDataUri}" alt="Niewdel" style="height: 22px; width: auto; margin-bottom: 8px; opacity: 0.3;" />` : `<div class="footer-brand">Niewdel</div>`}
      <div class="footer-tagline">Confidential &mdash; Prepared exclusively for ${escapeHtml(result.siteName)}</div>
    </div>
  </div>

</body>
</html>`;
}
