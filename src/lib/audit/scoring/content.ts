import { CategoryResult } from '../types';
import { ScoringInput } from './index';
import { generateNarrative } from './narratives';

function wordCount(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0).length;
}

export function score(input: ScoringInput): CategoryResult {
  const { pages, screenshots } = input;
  let total = 0;
  const findings: string[] = [];

  if (pages.length === 0) {
    return {
      category_id: 'content',
      category_name: 'Content Quality',
      score: 0,
      severity: 'critical',
      headline: 'No pages could be analyzed.',
      narrative: 'The crawl returned no pages, so content quality could not be assessed.',
      findings: ['No pages were available for analysis'],
    };
  }

  const homepage = pages.find((p) => {
    try {
      return new URL(p.url).pathname === '/' || new URL(p.url).pathname === '';
    } catch {
      return false;
    }
  }) || pages[0];

  // --- Homepage word count (15 / 8 / 3 / 0 pts) ---
  const homepageWords = wordCount(homepage.bodyText);

  if (homepageWords > 500) {
    total += 15;
  } else if (homepageWords > 300) {
    total += 8;
    findings.push(`Homepage has ${homepageWords} words -- could use more substantive content`);
  } else if (homepageWords > 200) {
    total += 3;
    findings.push(`Homepage has only ${homepageWords} words -- thin content hurts engagement and SEO`);
  } else {
    findings.push(`Homepage has only ${homepageWords} words -- severely thin content`);
  }

  // --- Average words per page (10 / 5 / 0 pts) ---
  const avgWords = pages.reduce((sum, p) => sum + wordCount(p.bodyText), 0) / pages.length;

  if (avgWords > 400) {
    total += 10;
  } else if (avgWords > 250) {
    total += 5;
    findings.push(`Average page has ${Math.round(avgWords)} words -- below the 400-word target for strong content`);
  } else {
    findings.push(`Average page has only ${Math.round(avgWords)} words -- content is too thin across the site`);
  }

  // --- No thin pages < 150 words (15 / 8 / 0 pts) ---
  const thinPages = pages.filter((p) => wordCount(p.bodyText) < 150);

  if (thinPages.length === 0) {
    total += 15;
  } else if (thinPages.length === 1) {
    total += 8;
    findings.push(`1 page has thin content (fewer than 150 words)`);
  } else {
    findings.push(`${thinPages.length} pages have thin content (fewer than 150 words)`);
  }

  // --- All page titles unique (8 pts) ---
  if (pages.length > 1) {
    const titles = pages.map((p) => p.title.trim().toLowerCase()).filter((t) => t.length > 0);
    const uniqueTitles = new Set(titles).size;

    if (uniqueTitles === titles.length) {
      total += 8;
    } else {
      const dupeCount = titles.length - uniqueTitles;
      findings.push(`${dupeCount} duplicate title tag(s) across ${pages.length} pages`);
    }
  } else {
    total += 8; // Single page, title is inherently unique
  }

  // --- No empty pages < 50 words (10 / 5 / 0 pts) ---
  const emptyPages = pages.filter((p) => wordCount(p.bodyText) < 50);

  if (emptyPages.length === 0) {
    total += 10;
  } else if (emptyPages.length === 1) {
    total += 5;
    findings.push(`1 page is essentially empty (fewer than 50 words)`);
  } else {
    findings.push(`${emptyPages.length} pages are essentially empty (fewer than 50 words)`);
  }

  // --- Zero broken images (8 pts) ---
  const brokenImages = screenshots.flatMap((s) =>
    s.issues.filter((i) => i.type === 'broken-image')
  );

  if (brokenImages.length === 0) {
    total += 8;
  } else {
    findings.push(`${brokenImages.length} broken image(s) detected across the site`);
  }

  // --- Has blog/news/articles section (10 pts) ---
  const contentSectionPaths = ['/blog', '/news', '/articles', '/resources', '/insights', '/posts'];
  const hasBlog = pages.some((p) => {
    try {
      const pathname = new URL(p.url).pathname.toLowerCase();
      return contentSectionPaths.some((cp) => pathname.startsWith(cp));
    } catch {
      return false;
    }
  }) || pages.some((p) =>
    p.links.some((l) => {
      const href = l.href.toLowerCase();
      const text = l.text.toLowerCase();
      return contentSectionPaths.some((cp) => href.includes(cp) || text.includes(cp.replace('/', '')));
    })
  );

  if (hasBlog) {
    total += 10;
  } else {
    findings.push('No blog, news, or articles section detected -- missing content marketing opportunity');
  }

  // --- Content freshness -- copyright year (5 pts) ---
  const allBodyText = pages.map((p) => p.bodyText).join(' ');
  const currentYear = new Date().getFullYear();
  const lastYear = currentYear - 1;
  const hasFreshCopyright =
    allBodyText.includes(String(currentYear)) || allBodyText.includes(String(lastYear));

  if (hasFreshCopyright) {
    total += 5;
  } else {
    findings.push(`No reference to ${currentYear} or ${lastYear} found -- site may appear outdated`);
  }

  // --- Good text-to-content ratio: >75% of pages have >200 words (8 pts) ---
  const substantialPages = pages.filter((p) => wordCount(p.bodyText) > 200);
  const substantialRatio = pages.length > 0 ? substantialPages.length / pages.length : 0;

  if (substantialRatio > 0.75) {
    total += 8;
  } else {
    findings.push(`Only ${substantialPages.length} of ${pages.length} pages have more than 200 words of content`);
  }

  // --- Descriptive meta descriptions >50 chars for >75% of pages (6 pts) ---
  const goodMetas = pages.filter(
    (p) => p.metaDescription && p.metaDescription.trim().length > 50
  );
  const goodMetaRatio = pages.length > 0 ? goodMetas.length / pages.length : 0;

  if (goodMetaRatio > 0.75) {
    total += 6;
  } else {
    findings.push(`Only ${goodMetas.length} of ${pages.length} pages have descriptive meta descriptions (>50 characters)`);
  }

  // --- Content depth: site has >6 pages (5 pts) ---
  if (pages.length > 6) {
    total += 5;
  } else {
    findings.push(`Site has only ${pages.length} page(s) -- limited content depth`);
  }

  const finalScore = Math.max(0, Math.min(100, total));
  const severity = scoreToSeverity(finalScore);
  const { headline, narrative } = generateNarrative('content', finalScore, findings);

  return {
    category_id: 'content',
    category_name: 'Content Quality',
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
