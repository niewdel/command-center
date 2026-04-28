import { CrawledPage, PSIMetrics, ScreenshotResult, CategoryResult } from '../types';
import { generateOverallNarrative } from './narratives';
import { score as scoreVisualDesign } from './visual-design';
import { score as scoreUsability } from './usability';
import { score as scoreCTA } from './cta';
import { score as scoreSEO } from './seo';
import { score as scorePerformance } from './performance';
import { score as scoreContent } from './content';
import { score as scoreTrust } from './trust';
import { score as scoreConversion } from './conversion';

export interface ScoringInput {
  pages: CrawledPage[];
  psiMetrics: PSIMetrics[];
  screenshots: ScreenshotResult[];
  rootUrl: string;
}

// Weights tuned as a "sales weapon" -- categories that create urgency are weighted higher
const CATEGORY_WEIGHTS: Record<string, number> = {
  'visual-design': 0.10,
  'usability': 0.10,
  'cta': 0.15,
  'seo': 0.15,
  'performance': 0.10,
  'content': 0.15,
  'trust': 0.15,
  'conversion': 0.10,
};

export function runScoring(input: ScoringInput): {
  overall_score: number;
  overall_severity: 'critical' | 'serious' | 'moderate' | 'acceptable' | 'strong';
  overall_headline: string;
  overall_narrative: string;
  categories: CategoryResult[];
} {
  // Run all 8 category scorers
  const categories: CategoryResult[] = [
    scoreVisualDesign(input),
    scoreUsability(input),
    scoreCTA(input),
    scoreSEO(input),
    scorePerformance(input),
    scoreContent(input),
    scoreTrust(input),
    scoreConversion(input),
  ];

  // Compute overall score as weighted average
  const overall_score = Math.round(
    categories.reduce((sum, c) => {
      const weight = CATEGORY_WEIGHTS[c.category_id] || (1 / categories.length);
      return sum + c.score * weight;
    }, 0)
  );

  // Map severity
  let overall_severity: 'critical' | 'serious' | 'moderate' | 'acceptable' | 'strong';
  if (overall_score <= 40) {
    overall_severity = 'critical';
  } else if (overall_score <= 65) {
    overall_severity = 'serious';
  } else if (overall_score <= 85) {
    overall_severity = 'acceptable';
  } else {
    overall_severity = 'strong';
  }

  // Generate overall narrative
  const { headline: overall_headline, narrative: overall_narrative } =
    generateOverallNarrative(overall_score, categories);

  return {
    overall_score,
    overall_severity,
    overall_headline,
    overall_narrative,
    categories,
  };
}
