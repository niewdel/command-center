import { CategoryResult } from '../types';
import { ScoringInput } from './index';
import { generateNarrative } from './narratives';

export function score(input: ScoringInput): CategoryResult {
  const { pages } = input;
  let total = 0;
  const findings: string[] = [];

  if (pages.length === 0) {
    return {
      category_id: 'seo',
      category_name: 'SEO Fundamentals',
      score: 0,
      severity: 'critical',
      headline: 'No pages could be analyzed.',
      narrative: 'The crawl returned no pages, so SEO could not be assessed.',
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

  // --- Title tags on every page (10 / 5 / 0 pts) ---
  const pagesWithTitle = pages.filter(
    (p) => p.title && p.title.trim().length > 0
  );
  const titleRatio = pages.length > 0 ? pagesWithTitle.length / pages.length : 0;

  if (titleRatio === 1) {
    total += 10;
  } else if (titleRatio > 0.75) {
    total += 5;
    findings.push(`${pagesWithTitle.length} of ${pages.length} pages have title tags (${Math.round(titleRatio * 100)}%)`);
  } else {
    findings.push(`Only ${pagesWithTitle.length} of ${pages.length} pages have title tags -- critical SEO gap`);
  }

  // --- All titles unique (8 / 4 pts) ---
  const titles = pages
    .map((p) => p.title.trim().toLowerCase())
    .filter((t) => t.length > 0);
  const uniqueTitles = new Set(titles).size;
  const titleUniquenessRatio = titles.length > 1 ? uniqueTitles / titles.length : 1;

  if (titleUniquenessRatio === 1 && titles.length > 1) {
    total += 8;
  } else if (titleUniquenessRatio > 0.75) {
    total += 4;
    const dupeCount = titles.length - uniqueTitles;
    findings.push(`${dupeCount} duplicate title tag(s) found across pages`);
  } else if (titles.length > 1) {
    const dupeCount = titles.length - uniqueTitles;
    findings.push(`${dupeCount} duplicate title tags -- search engines cannot differentiate your pages`);
  }

  // --- Meta descriptions on every page (10 / 5 / 0 pts) ---
  const pagesWithMeta = pages.filter(
    (p) => p.metaDescription && p.metaDescription.trim().length > 0
  );
  const metaRatio = pages.length > 0 ? pagesWithMeta.length / pages.length : 0;

  if (metaRatio === 1) {
    total += 10;
  } else if (metaRatio > 0.75) {
    total += 5;
    findings.push(`${pagesWithMeta.length} of ${pages.length} pages have meta descriptions`);
  } else {
    findings.push(`Only ${pagesWithMeta.length} of ${pages.length} pages have meta descriptions -- Google will auto-generate snippets`);
  }

  // --- All meta descriptions unique (8 / 4 pts) ---
  const metas = pages
    .map((p) => p.metaDescription.trim().toLowerCase())
    .filter((m) => m.length > 0);
  const uniqueMetas = new Set(metas).size;
  const metaUniquenessRatio = metas.length > 1 ? uniqueMetas / metas.length : 1;

  if (metaUniquenessRatio === 1 && metas.length > 1) {
    total += 8;
  } else if (metaUniquenessRatio > 0.75) {
    total += 4;
    findings.push(`${metas.length - uniqueMetas} duplicate meta description(s) found`);
  } else if (metas.length > 1) {
    findings.push(`${metas.length - uniqueMetas} duplicate meta descriptions -- pages compete with themselves in search results`);
  }

  // --- Every page has exactly 1 H1 (8 / 4 pts) ---
  const pagesWithSingleH1 = pages.filter((p) => {
    const h1Count = p.headings.filter((h) => h.level === 1).length;
    return h1Count === 1;
  });
  const h1Ratio = pages.length > 0 ? pagesWithSingleH1.length / pages.length : 0;

  if (h1Ratio === 1) {
    total += 8;
  } else if (h1Ratio > 0.75) {
    total += 4;
    const zeroH1 = pages.filter((p) => p.headings.filter((h) => h.level === 1).length === 0).length;
    const multiH1 = pages.filter((p) => p.headings.filter((h) => h.level === 1).length > 1).length;
    const parts: string[] = [];
    if (zeroH1 > 0) parts.push(`${zeroH1} with no H1`);
    if (multiH1 > 0) parts.push(`${multiH1} with multiple H1s`);
    findings.push(`H1 tag issues: ${parts.join(', ')}`);
  } else {
    const zeroH1 = pages.filter((p) => p.headings.filter((h) => h.level === 1).length === 0).length;
    const multiH1 = pages.filter((p) => p.headings.filter((h) => h.level === 1).length > 1).length;
    const parts: string[] = [];
    if (zeroH1 > 0) parts.push(`${zeroH1} pages missing H1`);
    if (multiH1 > 0) parts.push(`${multiH1} pages with multiple H1s`);
    findings.push(`Significant H1 problems: ${parts.join(', ')}`);
  }

  // --- Heading hierarchy logical (5 pts) ---
  const pagesWithSkippedLevels = pages.filter((p) => {
    const levels = p.headings.map((h) => h.level).sort((a, b) => a - b);
    for (let i = 1; i < levels.length; i++) {
      if (levels[i] - levels[i - 1] > 1) return true;
    }
    return false;
  });

  if (pagesWithSkippedLevels.length === 0) {
    total += 5;
  } else {
    findings.push(`${pagesWithSkippedLevels.length} page(s) have skipped heading levels (e.g., H1 to H3)`);
  }

  // --- Image alt text >80% (8 pts), 50-80% (4 pts) ---
  const allImages = pages.flatMap((p) => p.images);
  const imagesWithAlt = allImages.filter(
    (img) => img.alt && img.alt.trim().length > 0
  ).length;
  const altRatio = allImages.length > 0 ? imagesWithAlt / allImages.length : 1;

  if (allImages.length > 0) {
    if (altRatio > 0.8) {
      total += 8;
    } else if (altRatio >= 0.5) {
      total += 4;
      findings.push(`${Math.round(altRatio * 100)}% of images have alt text (${imagesWithAlt}/${allImages.length})`);
    } else {
      findings.push(`Only ${Math.round(altRatio * 100)}% of images have alt text (${imagesWithAlt}/${allImages.length}) -- search engines cannot index these images`);
    }
  }

  // --- sitemap.xml exists (8 pts) ---
  const hasSitemap = pages.some(
    (p) =>
      p.links.some((l) => l.href.toLowerCase().includes('sitemap')) ||
      p.url.toLowerCase().includes('sitemap')
  );

  if (hasSitemap) {
    total += 8;
  } else {
    findings.push('No sitemap.xml detected -- search engines may not discover all pages');
  }

  // --- robots.txt exists (5 pts) ---
  const hasRobots = pages.some(
    (p) =>
      p.links.some((l) => l.href.toLowerCase().includes('robots.txt')) ||
      p.url.toLowerCase().includes('robots.txt')
  );

  if (hasRobots) {
    total += 5;
  }
  // We don't penalize for missing robots.txt since we may not have crawled it directly

  // --- Canonical tags (5 pts) ---
  const hasCanonical = pages.some((p) =>
    p.headLinks.some((l) => l.rel === 'canonical')
  );
  if (hasCanonical) {
    total += 5;
  } else {
    findings.push('No canonical tags found -- risk of duplicate content issues in search engines');
  }

  // --- JSON-LD structured data (8 pts) ---
  const hasStructuredData = pages.some(
    (p) => p.structuredData && p.structuredData.length > 0
  );

  if (hasStructuredData) {
    total += 8;
  } else {
    findings.push('No structured data (JSON-LD) found on any page -- missing rich snippet opportunities');
  }

  // --- Open Graph tags on homepage (5 pts) ---
  const hasOgTags =
    homepage.ogTags &&
    Object.keys(homepage.ogTags).length > 0 &&
    (homepage.ogTags['og:title'] || homepage.ogTags['og:description']);

  if (hasOgTags) {
    total += 5;
  } else {
    findings.push('Homepage is missing Open Graph tags -- social shares will lack proper previews');
  }

  // --- No orphan pages (7 pts) ---
  // Count internal links pointing TO each page
  const inboundCounts = new Map<string, number>();
  for (const page of pages) {
    for (const link of page.links) {
      if (!link.isInternal) continue;
      try {
        const normalized = new URL(link.href, page.url).pathname.replace(/\/$/, '').toLowerCase();
        inboundCounts.set(normalized, (inboundCounts.get(normalized) || 0) + 1);
      } catch {
        // skip bad URLs
      }
    }
  }

  const orphanPages = pages.filter((p) => {
    try {
      const pathname = new URL(p.url).pathname.replace(/\/$/, '').toLowerCase();
      if (pathname === '' || pathname === '/') return false; // homepage is always linked
      return (inboundCounts.get(pathname) || 0) < 2;
    } catch {
      return false;
    }
  });

  if (orphanPages.length === 0) {
    total += 7;
  } else {
    findings.push(`${orphanPages.length} page(s) have fewer than 2 internal links pointing to them -- orphan pages`);
  }

  // --- Title tag proper length (5 pts for >75% compliance) ---
  const properLengthTitles = pages.filter((p) => {
    const len = p.title.trim().length;
    return len >= 30 && len <= 60;
  });
  const lengthRatio = pages.length > 0 ? properLengthTitles.length / pages.length : 0;

  if (lengthRatio > 0.75) {
    total += 5;
  } else {
    findings.push(`Only ${properLengthTitles.length} of ${pages.length} title tags are between 30-60 characters (optimal length)`);
  }

  const finalScore = Math.max(0, Math.min(100, total));
  const severity = scoreToSeverity(finalScore);
  const { headline, narrative } = generateNarrative('seo', finalScore, findings);

  return {
    category_id: 'seo',
    category_name: 'SEO Fundamentals',
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
