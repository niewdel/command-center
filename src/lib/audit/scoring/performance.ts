import { CategoryResult } from '../types';
import { ScoringInput } from './index';
import { generateNarrative } from './narratives';

export function score(input: ScoringInput): CategoryResult {
  const { psiMetrics } = input;
  const findings: string[] = [];

  // No PSI data = score 20 (unknown = bad)
  if (psiMetrics.length === 0) {
    return {
      category_id: 'performance',
      category_name: 'Performance & Speed',
      score: 20,
      severity: 'critical',
      headline: 'Performance could not be measured.',
      narrative:
        'No PageSpeed Insights data was available, so performance could not be verified. A score of 20/100 is assigned by default when performance data is unavailable -- unverified performance is a red flag.',
      findings: ['No PageSpeed Insights data available for analysis'],
    };
  }

  let total = 0;

  // Calculate averages across ALL tested pages
  const avgPerformance =
    psiMetrics.reduce((sum, m) => sum + m.scores.performance, 0) / psiMetrics.length;
  const avgPerformance100 = Math.round(avgPerformance * 100);

  const avgLcp =
    psiMetrics.reduce((sum, m) => sum + m.coreWebVitals.lcp, 0) / psiMetrics.length;
  const avgFcp =
    psiMetrics.reduce((sum, m) => sum + m.coreWebVitals.fcp, 0) / psiMetrics.length;
  const avgCls =
    psiMetrics.reduce((sum, m) => sum + m.coreWebVitals.cls, 0) / psiMetrics.length;
  const avgTbt =
    psiMetrics.reduce((sum, m) => sum + m.coreWebVitals.tbt, 0) / psiMetrics.length;
  const avgSi =
    psiMetrics.reduce((sum, m) => sum + m.coreWebVitals.speedIndex, 0) / psiMetrics.length;

  // --- Lighthouse performance score (30 / 20 / 12 / 5 pts) ---
  if (avgPerformance100 >= 90) {
    total += 30;
  } else if (avgPerformance100 >= 70) {
    total += 20;
    findings.push(`Average Lighthouse Performance score: ${avgPerformance100}/100 (needs improvement)`);
  } else if (avgPerformance100 >= 50) {
    total += 12;
    findings.push(`Average Lighthouse Performance score: ${avgPerformance100}/100 (poor)`);
  } else {
    total += 5;
    findings.push(`Average Lighthouse Performance score: ${avgPerformance100}/100 (very poor)`);
  }

  // --- LCP (15 / 8 / 0 pts) ---
  if (avgLcp < 2500) {
    total += 15;
  } else if (avgLcp < 4000) {
    total += 8;
    findings.push(`Largest Contentful Paint averages ${(avgLcp / 1000).toFixed(1)}s (should be under 2.5s)`);
  } else {
    findings.push(`Largest Contentful Paint averages ${(avgLcp / 1000).toFixed(1)}s (poor -- should be under 2.5s)`);
  }

  // --- FCP (10 / 5 / 0 pts) ---
  if (avgFcp < 1800) {
    total += 10;
  } else if (avgFcp < 3000) {
    total += 5;
    findings.push(`First Contentful Paint averages ${(avgFcp / 1000).toFixed(1)}s (should be under 1.8s)`);
  } else {
    findings.push(`First Contentful Paint averages ${(avgFcp / 1000).toFixed(1)}s (poor -- should be under 1.8s)`);
  }

  // --- CLS (10 / 5 / 0 pts) ---
  if (avgCls < 0.1) {
    total += 10;
  } else if (avgCls < 0.25) {
    total += 5;
    findings.push(`Cumulative Layout Shift averages ${avgCls.toFixed(3)} (should be under 0.1)`);
  } else {
    findings.push(`Cumulative Layout Shift averages ${avgCls.toFixed(3)} (poor -- should be under 0.1)`);
  }

  // --- TBT (10 / 5 / 0 pts) ---
  if (avgTbt < 200) {
    total += 10;
  } else if (avgTbt < 600) {
    total += 5;
    findings.push(`Total Blocking Time averages ${Math.round(avgTbt)}ms (should be under 200ms)`);
  } else {
    findings.push(`Total Blocking Time averages ${Math.round(avgTbt)}ms (poor -- should be under 200ms)`);
  }

  // --- Speed Index (10 / 5 / 0 pts) ---
  if (avgSi < 3400) {
    total += 10;
  } else if (avgSi < 5800) {
    total += 5;
    findings.push(`Speed Index averages ${(avgSi / 1000).toFixed(1)}s (should be under 3.4s)`);
  } else {
    findings.push(`Speed Index averages ${(avgSi / 1000).toFixed(1)}s (poor -- should be under 3.4s)`);
  }

  // --- Consistency bonus (10 / 5 pts) or penalty ---
  const allScores = psiMetrics.map((m) => Math.round(m.scores.performance * 100));
  const allAbove90 = allScores.every((s) => s >= 90);
  const allAbove70 = allScores.every((s) => s >= 70);
  const anyBelow50 = allScores.some((s) => s < 50);

  if (allAbove90) {
    total += 10;
  } else if (allAbove70) {
    total += 5;
  }

  if (anyBelow50) {
    total -= 5;
    const worstPage = psiMetrics.reduce((worst, m) =>
      m.scores.performance < worst.scores.performance ? m : worst
    );
    findings.push(`At least one page scores below 50 (${Math.round(worstPage.scores.performance * 100)}/100 at ${worstPage.url})`);
  }

  // --- Page weight bonus (5 pts) ---
  // Check if PSI audits mention total byte weight
  const primaryPsi = psiMetrics[0];
  const totalByteWeightAudit = primaryPsi.audits.find(
    (a) => a.id === 'total-byte-weight'
  );

  if (totalByteWeightAudit && totalByteWeightAudit.score !== null) {
    if (totalByteWeightAudit.score >= 0.5) {
      total += 5;
    } else {
      findings.push(`Homepage page weight is high: ${totalByteWeightAudit.displayValue || 'above recommended threshold'}`);
    }
  }

  // Multi-page context
  if (psiMetrics.length > 1) {
    const min = Math.min(...allScores);
    const max = Math.max(...allScores);
    if (max - min > 20) {
      findings.push(`Performance varies significantly across pages: ${min} to ${max} Lighthouse scores`);
    }
  }

  const finalScore = Math.max(0, Math.min(100, total));
  const severity = scoreToSeverity(finalScore);
  const { headline, narrative } = generateNarrative('performance', finalScore, findings);

  return {
    category_id: 'performance',
    category_name: 'Performance & Speed',
    score: finalScore,
    severity,
    headline,
    narrative,
    findings,
  };
}

function scoreToSeverity(score: number): 'critical' | 'serious' | 'moderate' | 'acceptable' | 'strong' {
  if (score <= 40) return 'critical';
  if (score <= 65) return 'serious';
  if (score <= 85) return 'acceptable';
  return 'strong';
}
