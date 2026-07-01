import type { AuditResult, CategoryResult, PSIMetrics } from './types';
import { findingCopy } from './finding-copy';

// ── Niewdel v3.0 palette (dark-first), inline hex ──────────────────────────
const JET = '#0D0D0D';        // page background
const ONYX = '#1A1A1A';       // cards / surfaces
const ELEVATED = '#141719';   // sunken / inset fills
const HAIRLINE = '#262B2E';   // borders
const CLOUD = '#F5F5F5';      // primary text on dark
const MUTED = '#9AA3A8';      // secondary text
const FAINT = '#5C666D';      // faint text / captions
const BLUE = '#3B86DB';       // primary accent (eyebrows, links, "strong")
const SUCCESS = '#2E7D5B';
const WARNING = '#B8841A';
const ERROR = '#C0413B';

function getScoreColor(score: number): string {
  if (score <= 40) return ERROR;
  if (score <= 65) return WARNING;
  if (score <= 85) return SUCCESS;
  return BLUE;
}

function getScoreLabel(score: number): string {
  if (score <= 40) return 'Major issues';
  if (score <= 65) return 'Needs work';
  if (score <= 85) return 'On track';
  return 'Strong';
}

function getSeverityIcon(score: number): string {
  if (score <= 40) return '&#9888;';
  if (score <= 65) return '&#9679;';
  return '&#10003;';
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
  if (value <= good) return { label: 'Good', color: SUCCESS };
  if (value <= poor) return { label: 'Needs work', color: WARNING };
  return { label: 'Poor', color: ERROR };
}

function renderCategorySection(cat: CategoryResult, index: number): string {
  const color = getScoreColor(cat.score);
  const label = getScoreLabel(cat.score);
  const icon = getSeverityIcon(cat.score);
  const issueCount = cat.findings.length;
  const categoryNumber = String(index + 1).padStart(2, '0');

  const findingsHtml = cat.findings
    .map((f) => {
      const copy = findingCopy(f.code);
      return `
      <li class="finding-item">
        <span class="finding-icon">&#10007;</span>
        <div class="finding-body">
          <p class="finding-plain">${escapeHtml(copy.plain)}</p>
          <p class="finding-impact">${escapeHtml(copy.impact)}</p>
        </div>
      </li>`;
    })
    .join('');

  return `
    <section class="category-section">
      <div class="category-header">
        <div class="category-meta">
          <span class="category-number">${categoryNumber}</span>
          <h2 class="category-name">${escapeHtml(cat.category_name)}</h2>
        </div>
        <div class="category-score-area">
          <div class="score-badge-lg" style="background: ${color}15; border-color: ${color};">
            <span class="score-badge-number" style="color: ${color};">${cat.score}</span>
            <span class="score-badge-max" style="color: ${color}80;">/100</span>
          </div>
          <span class="severity-label" style="color: ${color};">${icon} ${label}</span>
        </div>
      </div>
      <div class="category-body">
        <p class="category-headline" style="color: ${color};">${escapeHtml(cat.headline)}</p>
        <p class="category-narrative">${escapeHtml(cat.narrative)}</p>
        ${issueCount > 0
          ? `<div class="findings-header"><span class="findings-count">${issueCount} finding${issueCount !== 1 ? 's' : ''}</span></div>
             <ul class="findings-list">${findingsHtml}</ul>`
          : ''}
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
        <div class="score-bar-fill" style="width: ${cat.score}%; background: ${color};"></div>
      </div>
      <div class="score-bar-value" style="color: ${color};">${cat.score}</div>
      <div class="score-bar-status" style="color: ${color};">${label}</div>
    </div>`;
}

function renderCwvMetric(label: string, key: string, value: number, target: string): string {
  const status = getCwvStatus(key, value);
  const displayValue = key === 'cls' ? value.toFixed(3) : formatMs(value);
  return `
    <div class="cwv-metric">
      <div class="cwv-value" style="color: ${status.color};">${displayValue}</div>
      <div class="cwv-label">${label}</div>
      <div class="cwv-status" style="color: ${status.color}; background: ${status.color}15;">${status.label}</div>
      <div class="cwv-target">Target ${target}</div>
    </div>`;
}

function renderPerformanceDashboard(psiMetrics: PSIMetrics[]): string {
  if (!psiMetrics || psiMetrics.length === 0) {
    return `
      <section class="perf-dashboard">
        <p class="section-tag">02 · Performance</p>
        <h2 class="section-title">Page speed</h2>
        <p class="section-subtitle">Core Web Vitals from Google PageSpeed Insights.</p>
        <div class="perf-unavailable">
          <span class="perf-unavailable-icon">&#9888;</span>
          <p>Performance data could not be retrieved. The site may be unreachable or extremely slow to respond.</p>
        </div>
      </section>`;
  }

  const avg = {
    performance: Math.round(psiMetrics.reduce((s, m) => s + m.scores.performance, 0) / psiMetrics.length),
    lcp: psiMetrics.reduce((s, m) => s + m.coreWebVitals.lcp, 0) / psiMetrics.length,
    fcp: psiMetrics.reduce((s, m) => s + m.coreWebVitals.fcp, 0) / psiMetrics.length,
    cls: psiMetrics.reduce((s, m) => s + m.coreWebVitals.cls, 0) / psiMetrics.length,
    tbt: psiMetrics.reduce((s, m) => s + m.coreWebVitals.tbt, 0) / psiMetrics.length,
    speedIndex: psiMetrics.reduce((s, m) => s + m.coreWebVitals.speedIndex, 0) / psiMetrics.length,
  };

  const perfColor = getScoreColor(avg.performance);

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
      <p class="section-tag">02 · Performance</p>
      <h2 class="section-title">Page speed</h2>
      <p class="section-subtitle">Core Web Vitals from Google PageSpeed Insights.</p>

      <div class="perf-overview">
        <div class="perf-score-ring" style="border-color: ${perfColor};">
          <span class="perf-score-number" style="color: ${perfColor};">${avg.performance}</span>
          <span class="perf-score-unit">avg</span>
        </div>
        <div class="perf-cwv-grid">
          ${renderCwvMetric('Largest Contentful Paint', 'lcp', avg.lcp, '&lt; 2.5s')}
          ${renderCwvMetric('First Contentful Paint', 'fcp', avg.fcp, '&lt; 1.8s')}
          ${renderCwvMetric('Cumulative Layout Shift', 'cls', avg.cls, '&lt; 0.1')}
          ${renderCwvMetric('Total Blocking Time', 'tbt', avg.tbt, '&lt; 200ms')}
          ${renderCwvMetric('Speed Index', 'speedIndex', avg.speedIndex, '&lt; 3.4s')}
        </div>
      </div>

      <div class="page-scores">
        <h3 class="subsection-title">Per page</h3>
        ${pageScoresHtml}
      </div>
    </section>`;
}

function renderStatsBar(result: AuditResult): string {
  const totalFindings = result.categories.reduce((s, c) => s + c.findings.length, 0);
  const criticalCategories = result.categories.filter((c) => c.score <= 40).length;
  const seriousCategories = result.categories.filter((c) => c.score > 40 && c.score <= 65).length;

  return `
    <div class="stats-bar">
      <div class="stat-item">
        <div class="stat-number">${result.pagesCrawled}</div>
        <div class="stat-label">Pages</div>
      </div>
      <div class="stat-divider"></div>
      <div class="stat-item">
        <div class="stat-number">${result.psiMetrics.length}</div>
        <div class="stat-label">Speed tests</div>
      </div>
      <div class="stat-divider"></div>
      <div class="stat-item">
        <div class="stat-number" style="color: ${WARNING};">${totalFindings}</div>
        <div class="stat-label">Findings</div>
      </div>
      <div class="stat-divider"></div>
      <div class="stat-item">
        <div class="stat-number" style="color: ${ERROR};">${criticalCategories}</div>
        <div class="stat-label">Critical areas</div>
      </div>
      <div class="stat-divider"></div>
      <div class="stat-item">
        <div class="stat-number" style="color: ${WARNING};">${seriousCategories}</div>
        <div class="stat-label">Needs work</div>
      </div>
    </div>`;
}

function renderAlertBanner(result: AuditResult): string {
  if (result.overall_score > 65) return '';

  const isCritical = result.overall_score <= 40;
  const borderColor = isCritical ? ERROR : WARNING;
  const title = isCritical ? 'Critical issues detected' : 'Significant issues detected';
  const message = isCritical
    ? 'This site has critical deficiencies that are actively costing the business customers and revenue.'
    : 'This site has multiple areas below industry standards. These issues are likely impacting acquisition and credibility.';

  return `
    <div class="alert-banner" style="background: ${borderColor}10; border-color: ${borderColor}40;">
      <div class="alert-icon" style="color: ${borderColor};">&#9888;</div>
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
  const perfDashboardHtml = renderPerformanceDashboard(result.psiMetrics);
  const statsBarHtml = renderStatsBar(result);
  const alertBannerHtml = renderAlertBanner(result);

  const totalFindings = result.categories.reduce((s, c) => s + c.findings.length, 0);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Website Audit, ${escapeHtml(result.siteName)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Montserrat:wght@400;600;700;800&display=swap" rel="stylesheet" />
  <style>
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: ${JET};
      color: ${CLOUD};
      line-height: 1.65;
      -webkit-font-smoothing: antialiased;
    }

    .container { max-width: 940px; margin: 0 auto; padding: 0 36px; }

    .section-tag {
      font-family: 'Montserrat', 'Inter', sans-serif;
      font-size: 11px; font-weight: 600;
      letter-spacing: 0.22em; text-transform: uppercase;
      color: ${BLUE}; margin-bottom: 12px;
    }

    /* ── Cover ─────────────────────────────────────────── */

    .cover {
      min-height: 100vh;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      text-align: center; padding: 80px 32px;
      background: ${JET};
    }
    .cover-tag {
      font-family: 'Montserrat', 'Inter', sans-serif; font-weight: 600;
      font-size: 12px; letter-spacing: 0.22em; text-transform: uppercase;
      color: ${BLUE}; margin-bottom: 48px;
    }
    .cover-logo { margin-bottom: 36px; }
    .cover-logo img { height: 44px; width: auto; display: block; margin: 0 auto; }
    .cover-logo-text {
      font-family: 'Montserrat', 'Inter', sans-serif; font-weight: 700;
      font-size: 32px; letter-spacing: -0.02em; color: ${CLOUD};
    }
    .cover-score-ring {
      width: 220px; height: 220px; border-radius: 50%;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      margin-bottom: 32px;
      background: ${ONYX};
      border: 3px solid ${overallColor};
    }
    .cover-score-number {
      font-family: 'Montserrat', 'Inter', sans-serif; font-weight: 800; font-size: 80px;
      color: ${overallColor}; line-height: 1; letter-spacing: -0.03em;
    }
    .cover-score-of {
      font-family: 'Montserrat', 'Inter', sans-serif; font-weight: 500; font-size: 16px;
      color: ${overallColor}; opacity: 0.6; margin-top: 2px;
    }
    .cover-score-label {
      font-family: 'Montserrat', 'Inter', sans-serif; font-weight: 600; font-size: 12px;
      letter-spacing: 0.22em; text-transform: uppercase; color: ${overallColor};
      margin-top: 16px; padding: 6px 18px;
      border: 1px solid ${overallColor}; border-radius: 999px;
      background: ${overallColor}10;
    }
    .cover-site-name {
      font-family: 'Montserrat', 'Inter', sans-serif; font-weight: 700; font-size: 32px;
      color: ${CLOUD}; margin-top: 36px; letter-spacing: -0.02em;
    }
    .cover-url { font-size: 14px; color: ${MUTED}; margin-top: 6px; word-break: break-all; }
    .cover-date { font-size: 13px; color: ${FAINT}; margin-top: 4px; }

    /* ── Stats Bar ─────────────────────────────────────── */

    .stats-bar {
      display: flex; justify-content: center; align-items: center;
      padding: 24px 0; margin: 0 -36px;
      background: ${ONYX};
      border-top: 1px solid ${HAIRLINE};
      border-bottom: 1px solid ${HAIRLINE};
    }
    .stat-item { text-align: center; padding: 0 28px; }
    .stat-number {
      font-family: 'Montserrat', 'Inter', sans-serif; font-weight: 700; font-size: 26px;
      color: ${CLOUD}; letter-spacing: -0.02em;
    }
    .stat-label {
      font-family: 'Montserrat', 'Inter', sans-serif; font-size: 10px;
      color: ${MUTED}; text-transform: uppercase;
      letter-spacing: 0.18em; margin-top: 4px;
    }
    .stat-divider { width: 1px; height: 36px; background: ${HAIRLINE}; }

    /* ── Alert Banner ──────────────────────────────────── */

    .alert-banner {
      display: flex; align-items: flex-start; gap: 14px;
      padding: 18px 22px; border-radius: 10px; margin: 40px 0 0;
      border: 1px solid;
    }
    .alert-icon { font-size: 22px; flex-shrink: 0; margin-top: 1px; }
    .alert-title {
      font-family: 'Montserrat', 'Inter', sans-serif; font-weight: 700; font-size: 15px; margin-bottom: 4px;
      letter-spacing: -0.01em;
    }
    .alert-message { font-size: 13px; color: ${MUTED}; line-height: 1.65; }

    .section-divider { width: 100%; height: 1px; background: ${HAIRLINE}; margin: 56px 0; }

    /* ── Section Titles ────────────────────────────────── */

    .section-title {
      font-family: 'Montserrat', 'Inter', sans-serif; font-weight: 700; font-size: 28px;
      color: ${CLOUD}; margin-bottom: 8px; letter-spacing: -0.015em;
    }
    .section-subtitle { font-size: 14px; color: ${MUTED}; margin-bottom: 32px; max-width: 60ch; }
    .subsection-title {
      font-family: 'Montserrat', 'Inter', sans-serif; font-weight: 600; font-size: 11px;
      color: ${MUTED}; text-transform: uppercase;
      letter-spacing: 0.22em; margin-bottom: 14px; margin-top: 32px;
    }

    /* ── Executive Summary ─────────────────────────────── */

    .executive { padding: 56px 0 0; }
    .overall-headline {
      font-family: 'Montserrat', 'Inter', sans-serif; font-weight: 700; font-size: 22px;
      margin-bottom: 14px; line-height: 1.3; letter-spacing: -0.01em;
    }
    .overall-narrative { font-size: 15px; color: ${CLOUD}; line-height: 1.75; margin-bottom: 40px; max-width: 65ch; }

    /* ── Score Bars ────────────────────────────────────── */

    .score-bars { margin-bottom: 16px; }
    .score-bar-row { display: flex; align-items: center; margin-bottom: 12px; }
    .score-bar-label {
      width: 190px; flex-shrink: 0; font-size: 13px; font-weight: 500;
      color: ${MUTED}; text-align: right; padding-right: 18px;
    }
    .score-bar-track {
      flex: 1; height: 10px;
      background: ${ELEVATED};
      border-radius: 5px; overflow: hidden;
    }
    .score-bar-fill { height: 100%; border-radius: 5px; }
    .score-bar-value {
      width: 36px; flex-shrink: 0; text-align: right;
      font-family: 'Montserrat', 'Inter', sans-serif; font-weight: 700; font-size: 14px; padding-left: 12px;
      font-variant-numeric: tabular-nums;
    }
    .score-bar-status {
      width: 110px; flex-shrink: 0; text-align: right;
      font-family: 'Montserrat', 'Inter', sans-serif; font-size: 10px; font-weight: 600;
      text-transform: uppercase; letter-spacing: 0.16em; padding-left: 10px;
    }

    /* ── Performance Dashboard ─────────────────────────── */

    .perf-dashboard { padding: 0; }
    .perf-overview { display: flex; align-items: flex-start; gap: 32px; margin-bottom: 16px; }
    .perf-score-ring {
      width: 120px; height: 120px; border-radius: 50%; flex-shrink: 0;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      background: ${ONYX}; border: 3px solid;
    }
    .perf-score-number {
      font-family: 'Montserrat', 'Inter', sans-serif; font-weight: 800; font-size: 36px; line-height: 1; letter-spacing: -0.025em;
    }
    .perf-score-unit { font-size: 11px; color: ${FAINT}; margin-top: 2px; }
    .perf-cwv-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; flex: 1; }
    .cwv-metric {
      background: ${ONYX}; border: 1px solid ${HAIRLINE};
      border-radius: 10px; padding: 14px; text-align: center;
    }
    .cwv-value {
      font-family: 'Montserrat', 'Inter', sans-serif; font-weight: 700; font-size: 22px;
      font-variant-numeric: tabular-nums; letter-spacing: -0.01em;
    }
    .cwv-label { font-size: 11px; color: ${MUTED}; margin-top: 4px; line-height: 1.3; }
    .cwv-status {
      display: inline-block;
      font-family: 'Montserrat', 'Inter', sans-serif; font-size: 9px; font-weight: 600;
      text-transform: uppercase; letter-spacing: 0.18em;
      padding: 3px 10px; border-radius: 999px; margin-top: 8px;
    }
    .cwv-target {
      font-family: 'Montserrat', 'Inter', sans-serif; font-size: 10px;
      color: ${FAINT}; margin-top: 6px;
    }

    .page-scores { margin-top: 8px; }
    .page-score-row { display: flex; align-items: center; margin-bottom: 10px; }
    .page-score-path {
      width: 200px; flex-shrink: 0; font-size: 12px; color: ${MUTED};
      font-family: 'Montserrat', 'Inter', sans-serif;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .page-score-bar-track {
      flex: 1; height: 8px; background: ${ELEVATED};
      border-radius: 4px; overflow: hidden;
    }
    .page-score-bar-fill { height: 100%; border-radius: 4px; }
    .page-score-value {
      width: 40px; flex-shrink: 0; text-align: right;
      font-family: 'Montserrat', 'Inter', sans-serif; font-weight: 700; font-size: 13px; padding-left: 12px;
      font-variant-numeric: tabular-nums;
    }

    .perf-unavailable {
      display: flex; align-items: center; gap: 14px;
      background: ${ERROR}08; border: 1px solid ${ERROR}40;
      border-radius: 10px; padding: 22px;
    }
    .perf-unavailable-icon { font-size: 26px; flex-shrink: 0; }
    .perf-unavailable p { font-size: 14px; color: ${CLOUD}; }

    /* ── Category Deep-Dives ───────────────────────────── */

    .categories { padding: 0 0 20px; }
    .category-section {
      background: ${ONYX};
      border: 1px solid ${HAIRLINE};
      border-radius: 12px; padding: 28px 32px; margin-bottom: 18px;
    }
    .category-header {
      display: flex; align-items: flex-start; justify-content: space-between;
      margin-bottom: 20px; gap: 16px;
    }
    .category-meta { display: flex; align-items: center; gap: 14px; }
    .category-number {
      font-family: 'Montserrat', 'Inter', sans-serif; font-weight: 600; font-size: 12px;
      color: ${FAINT}; background: ${ELEVATED};
      width: 32px; height: 32px; border-radius: 6px;
      display: flex; align-items: center; justify-content: center;
    }
    .category-name {
      font-family: 'Montserrat', 'Inter', sans-serif; font-weight: 700; font-size: 19px; color: ${CLOUD};
      letter-spacing: -0.01em;
    }
    .category-score-area { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; flex-shrink: 0; }
    .score-badge-lg {
      display: flex; align-items: baseline; gap: 2px; padding: 6px 14px;
      border-radius: 10px; border: 2px solid;
    }
    .score-badge-number {
      font-family: 'Montserrat', 'Inter', sans-serif; font-weight: 800; font-size: 26px; letter-spacing: -0.02em;
    }
    .score-badge-max { font-family: 'Montserrat', 'Inter', sans-serif; font-weight: 500; font-size: 13px; }
    .severity-label {
      font-family: 'Montserrat', 'Inter', sans-serif; font-size: 10px; font-weight: 600;
      text-transform: uppercase; letter-spacing: 0.18em;
    }

    .category-headline {
      font-family: 'Montserrat', 'Inter', sans-serif; font-weight: 700; font-size: 16px;
      margin-bottom: 10px; line-height: 1.4; letter-spacing: -0.01em;
    }
    .category-narrative { font-size: 14px; color: ${MUTED}; line-height: 1.7; margin-bottom: 20px; max-width: 62ch; }

    .findings-header { margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid ${HAIRLINE}; }
    .findings-count {
      font-family: 'Montserrat', 'Inter', sans-serif; font-weight: 600; font-size: 10px;
      color: ${MUTED}; text-transform: uppercase; letter-spacing: 0.22em;
    }
    .findings-list { list-style: none; padding: 0; }
    .finding-item {
      display: flex; align-items: flex-start; gap: 10px;
      padding: 12px 0; font-size: 13px; color: ${CLOUD}; line-height: 1.5;
      border-bottom: 1px solid ${ELEVATED};
    }
    .finding-item:last-child { border-bottom: none; }
    .finding-icon { color: ${ERROR}; font-size: 13px; flex-shrink: 0; margin-top: 2px; font-weight: 700; }
    .finding-body { flex: 1; }
    .finding-plain { font-size: 14px; color: ${CLOUD}; font-weight: 500; line-height: 1.55; }
    .finding-impact { font-size: 12.5px; color: ${MUTED}; line-height: 1.55; margin-top: 4px; }

    /* ── Soft Close ────────────────────────────────────── */

    .closing { padding: 8px 0 24px; max-width: 68ch; }
    .closing-copy { font-size: 15px; color: ${MUTED}; line-height: 1.75; }

    /* ── Footer ────────────────────────────────────────── */

    .footer { text-align: left; padding: 36px 0; border-top: 1px solid ${HAIRLINE}; margin-top: 24px; }
    .footer-brand {
      font-family: 'Montserrat', 'Inter', sans-serif; font-weight: 700; font-size: 16px;
      color: ${CLOUD}; letter-spacing: -0.01em;
    }
    .footer-tagline { font-size: 12px; color: ${FAINT}; margin-top: 6px; }

    @media print {
      .cover { min-height: auto; padding: 60px 32px; page-break-after: always; }
      .category-section, .cwv-metric, .alert-banner { page-break-inside: avoid; }
    }
  </style>
</head>
<body>

  <!-- Cover -->
  <div class="cover">
    <div class="cover-tag">Website Audit</div>
    <div class="cover-logo">${logoDataUri ? `<img src="${logoDataUri}" alt="Niewdel" />` : `<span class="cover-logo-text">niewdel</span>`}</div>
    <div class="cover-score-ring">
      <div class="cover-score-number">${result.overall_score}</div>
      <div class="cover-score-of">out of 100</div>
    </div>
    <div class="cover-score-label">${overallLabel}</div>
    <div class="cover-site-name">${escapeHtml(result.siteName)}</div>
    <div class="cover-url">${escapeHtml(result.url)}</div>
    <div class="cover-date">${escapeHtml(result.auditDate)} · ${result.pagesCrawled} page${result.pagesCrawled !== 1 ? 's' : ''} reviewed</div>
  </div>

  <div class="container">
    ${statsBarHtml}
    ${alertBannerHtml}

    <!-- Executive Summary -->
    <section class="executive">
      <p class="section-tag">01 · Summary</p>
      <h1 class="section-title">Executive summary</h1>
      <p class="section-subtitle">Scored ${result.overall_score}/100 across ${result.categories.length} audit categories. ${totalFindings} finding${totalFindings !== 1 ? 's' : ''}.</p>
      <p class="overall-headline" style="color: ${overallColor};">${escapeHtml(result.overall_headline)}</p>
      <p class="overall-narrative">${escapeHtml(result.overall_narrative)}</p>

      <h3 class="subsection-title">Category scores</h3>
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
      <p class="section-tag">03 · Findings</p>
      <h2 class="section-title">What we found, category by category</h2>
      <p class="section-subtitle">Plain-language problems and what each one is costing you -- no jargon.</p>
      <div style="margin-top: 24px;">
        ${categorySectionsHtml}
      </div>
    </section>

    <div class="section-divider"></div>

    <!-- Soft close -->
    <section class="closing">
      <p class="section-tag">04 · Next steps</p>
      <h2 class="section-title">This is fixable.</h2>
      <p class="closing-copy">
        None of this is unusual, and none of it is permanent. Every issue in this report is one we fix
        regularly for other businesses just like yours -- that's what we do. The next step is a short
        conversation about which fixes will move the needle fastest for ${escapeHtml(result.siteName)}.
      </p>
    </section>

    <!-- Footer -->
    <div class="footer">
      <div class="footer-brand">niewdel</div>
      <div class="footer-tagline">Internal audit report, ${escapeHtml(result.siteName)} · ${escapeHtml(result.auditDate)}</div>
    </div>
  </div>

</body>
</html>`;
}
