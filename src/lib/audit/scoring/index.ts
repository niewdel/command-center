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
import { score as scoreAeo } from './aeo';

export interface ScoringInput {
  pages: CrawledPage[];
  psiMetrics: PSIMetrics[];
  screenshots: ScreenshotResult[];
  rootUrl: string;
}

// Weights tuned as a "sales weapon" -- categories that create urgency are weighted higher.
// Whole numbers that must sum to exactly 100 (see docs/sdd/task-5-brief.md §3).
export const CATEGORY_WEIGHTS: Record<string, number> = {
  'visual-design': 8,
  'usability': 8,
  'cta': 13,
  'seo': 13,
  'performance': 10,
  'content': 13,
  'trust': 13,
  'conversion': 10,
  'aeo': 12,
};

export async function runScoring(input: ScoringInput): Promise<{
  overall_score: number;
  overall_severity: 'critical' | 'serious' | 'moderate' | 'acceptable' | 'strong';
  overall_headline: string;
  overall_narrative: string;
  categories: CategoryResult[];
}> {
  // Run all 9 category scorers (8 sync + AEO, which is async — it fetches
  // robots.txt/llms.txt to derive AI-bot access signals).
  const categories: CategoryResult[] = [
    scoreVisualDesign(input),
    scoreUsability(input),
    scoreCTA(input),
    await scoreSEO(input),
    scorePerformance(input),
    scoreContent(input),
    scoreTrust(input),
    scoreConversion(input),
    await scoreAeo(input.pages, input.rootUrl),
  ];

  // Compute overall score as weighted average (weights are 0-100, so divide by 100)
  const overall_score = Math.round(
    categories.reduce((sum, c) => {
      const weight = (CATEGORY_WEIGHTS[c.category_id] ?? (100 / categories.length)) / 100;
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
