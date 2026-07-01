import { CategoryResult, CrawledPage } from '../types';
import { fetchAeoRobotsSignals } from '../crawl';
import { scoreAeo, type AeoPage } from '@/lib/seo/aeo-score';
import { generateNarrative } from './narratives';

/**
 * Thin adapter over the shared `scoreAeo` (src/lib/seo/aeo-score.ts): maps the
 * audit tool's `CrawledPage[]` to the scorer's normalized `AeoPage[]` and
 * derives `blockedAiBots`/`hasLlmsTxt` from the site's robots.txt + a
 * `/llms.txt` HEAD check. No AEO scoring logic lives here — it's all in the
 * shared module so the recurring SEO agent (Task 11) can reuse it verbatim.
 */

function toAeoPage(page: CrawledPage): AeoPage {
  return {
    url: page.url,
    headings: page.headings,
    bodyText: page.bodyText,
    structuredData: page.structuredData,
    metaDescription: page.metaDescription,
    ogTags: page.ogTags,
  };
}

function scoreToSeverity(score: number): 'critical' | 'serious' | 'moderate' | 'acceptable' | 'strong' {
  if (score <= 40) return 'critical';
  if (score <= 65) return 'serious';
  if (score <= 85) return 'acceptable';
  return 'strong';
}

export async function score(pages: CrawledPage[], rootUrl: string): Promise<CategoryResult> {
  if (pages.length === 0) {
    return {
      category_id: 'aeo',
      category_name: 'AI Search (AEO)',
      score: 0,
      severity: 'critical',
      headline: 'No pages could be analyzed.',
      narrative: 'The crawl returned no pages, so AI-search readiness could not be assessed.',
      findings: [],
    };
  }

  const { blockedAiBots, hasLlmsTxt } = await fetchAeoRobotsSignals(rootUrl);
  const { score: finalScore, findings } = scoreAeo({
    pages: pages.map(toAeoPage),
    blockedAiBots,
    hasLlmsTxt,
  });

  const severity = scoreToSeverity(finalScore);
  const { headline, narrative } = generateNarrative(
    'aeo',
    finalScore,
    findings.map((f) => f.label)
  );

  return {
    category_id: 'aeo',
    category_name: 'AI Search (AEO)',
    score: finalScore,
    severity,
    headline,
    narrative,
    findings,
  };
}
