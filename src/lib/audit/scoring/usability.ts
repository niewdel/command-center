import { CategoryResult } from '../types';
import { ScoringInput } from './index';
import { generateNarrative } from './narratives';

export function score(input: ScoringInput): CategoryResult {
  const { pages, rootUrl, screenshots } = input;
  let total = 0;
  const findings: string[] = [];

  if (pages.length === 0) {
    return {
      category_id: 'usability',
      category_name: 'Usability & Navigation',
      score: 0,
      severity: 'critical',
      headline: 'No pages could be analyzed.',
      narrative: 'The crawl returned no pages, so usability could not be assessed.',
      findings: ['No pages were available for analysis'],
    };
  }

  const homepage = pages.find((p) => {
    try {
      const u = new URL(p.url);
      return u.pathname === '/' || u.pathname === '';
    } catch {
      return false;
    }
  }) || pages[0];

  // --- Semantic nav element (10 pts) or nav-like links (5 pts) ---
  // We check for navigation keyword patterns in links as a proxy
  const NAV_KEYWORDS = [
    'home', 'about', 'contact', 'services', 'products', 'blog', 'portfolio',
    'team', 'pricing', 'faq', 'help', 'support', 'careers', 'news',
    'testimonials', 'reviews', 'menu', 'shop', 'store',
  ];

  const homepageLinks = homepage.links.filter((l) => l.isInternal);
  const navLinks = homepageLinks.filter((l) => {
    const text = l.text.toLowerCase().trim();
    const href = l.href.toLowerCase();
    return NAV_KEYWORDS.some((kw) => text.includes(kw) || href.includes(kw));
  });
  // Also count buttons with nav-like text
  const navButtons = homepage.buttons.filter((b) => {
    const text = b.text.toLowerCase().trim();
    return NAV_KEYWORDS.some((kw) => text.includes(kw));
  });
  const totalNavElements = navLinks.length + navButtons.length;

  // Check if body text suggests semantic nav usage
  const bodyLower = homepage.bodyText.toLowerCase();
  const hasSemanticNav = bodyLower.includes('navigation') || bodyLower.includes('nav ') || bodyLower.includes('menu');

  if (totalNavElements >= 3 && hasSemanticNav) {
    total += 10;
  } else if (totalNavElements >= 3) {
    total += 5;
    findings.push('Navigation links found but may not use semantic <nav> element');
  } else {
    findings.push('No recognizable navigation structure detected on homepage');
  }

  // --- Navigation present on ALL pages (8 pts) or most (4 pts) ---
  const pagesWithNav = pages.filter((p) => {
    const internalLinks = p.links.filter((l) => l.isInternal);
    const navCount = internalLinks.filter((l) => {
      const text = l.text.toLowerCase().trim();
      const href = l.href.toLowerCase();
      return NAV_KEYWORDS.some((kw) => text.includes(kw) || href.includes(kw));
    }).length;
    return navCount >= 3;
  }).length;

  const navRatio = pages.length > 0 ? pagesWithNav / pages.length : 0;
  if (navRatio === 1) {
    total += 8;
  } else if (navRatio > 0.5) {
    total += 4;
    findings.push(`Navigation found on ${pagesWithNav} of ${pages.length} pages (${Math.round(navRatio * 100)}%)`);
  } else {
    findings.push(`Navigation only found on ${pagesWithNav} of ${pages.length} pages -- inconsistent navigation`);
  }

  // --- Click depth: all pages within 2 clicks (10 pts), within 3 (5 pts) ---
  const pageUrls = new Set(pages.map((p) => normalizeUrl(p.url)));
  const homepageUrl = normalizeUrl(homepage.url);
  const reachable = new Map<string, number>();
  reachable.set(homepageUrl, 0);

  const queue: { url: string; depth: number }[] = [{ url: homepageUrl, depth: 0 }];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.depth >= 3) continue;

    const page = pages.find((p) => normalizeUrl(p.url) === current.url);
    if (!page) continue;

    for (const link of page.links) {
      if (!link.isInternal) continue;
      const normalized = normalizeUrl(resolveUrl(rootUrl, link.href));
      if (!pageUrls.has(normalized)) continue;
      if (reachable.has(normalized)) continue;
      reachable.set(normalized, current.depth + 1);
      queue.push({ url: normalized, depth: current.depth + 1 });
    }
  }

  const allWithin2 = pages.every((p) => {
    const depth = reachable.get(normalizeUrl(p.url));
    return depth !== undefined && depth <= 2;
  });
  const allWithin3 = pages.every((p) => reachable.has(normalizeUrl(p.url)));
  const unreachableCount = pages.filter((p) => !reachable.has(normalizeUrl(p.url))).length;

  if (allWithin2) {
    total += 10;
  } else if (allWithin3) {
    total += 5;
    findings.push('All pages reachable within 3 clicks, but not all within 2');
  } else {
    findings.push(`${unreachableCount} page(s) not reachable within 3 clicks from homepage`);
  }

  // --- Broken links (15 / 8 / 0 pts) ---
  const brokenPages = pages.filter((p) => p.statusCode >= 400);
  if (brokenPages.length === 0) {
    total += 15;
  } else if (brokenPages.length <= 2) {
    total += 8;
    findings.push(`${brokenPages.length} broken page(s) detected (HTTP ${brokenPages.map((p) => p.statusCode).join(', ')})`);
  } else {
    findings.push(`${brokenPages.length} broken pages detected -- significant navigation failures`);
  }

  // --- Internal linking avg >5 (10 pts), >3 (5 pts) ---
  const avgInternalLinks =
    pages.reduce((sum, p) => sum + p.links.filter((l) => l.isInternal).length, 0) / pages.length;

  if (avgInternalLinks > 5) {
    total += 10;
  } else if (avgInternalLinks > 3) {
    total += 5;
    findings.push(`Average of ${avgInternalLinks.toFixed(1)} internal links per page -- could be stronger`);
  } else {
    findings.push(`Only ${avgInternalLinks.toFixed(1)} internal links per page on average -- weak internal linking`);
  }

  // --- Skip navigation link (8 pts) ---
  const hasSkipNav = pages.some((p) => {
    const body = p.bodyText.toLowerCase();
    return body.includes('skip to') || body.includes('skip nav') || body.includes('skip to content') || body.includes('skip to main');
  }) || pages.some((p) =>
    p.links.some((l) => l.text.toLowerCase().includes('skip') && l.href.includes('#'))
  );

  if (hasSkipNav) {
    total += 8;
  } else {
    findings.push('No skip navigation link found -- accessibility gap for keyboard users');
  }

  // --- Accessibility violations (10 / 5 / 0 pts) ---
  const criticalAccessibilityIssues = screenshots.flatMap((s) =>
    s.issues.filter(
      (i) => i.type === 'accessibility' && (i.severity === 'critical' || i.severity === 'serious')
    )
  );

  if (criticalAccessibilityIssues.length === 0) {
    total += 10;
  } else if (criticalAccessibilityIssues.length <= 3) {
    total += 5;
    findings.push(`${criticalAccessibilityIssues.length} critical accessibility issue(s) detected`);
  } else {
    findings.push(`${criticalAccessibilityIssues.length} critical accessibility issues detected -- significant barrier for users with disabilities`);
  }

  // --- Unique, descriptive titles (8 / 4 pts) ---
  const goodTitles = pages.filter((p) => {
    const title = p.title.trim();
    if (title.length < 10) return false;
    try {
      const domain = new URL(p.url).hostname.replace('www.', '');
      if (title.toLowerCase() === domain.toLowerCase()) return false;
    } catch {
      // ignore
    }
    return true;
  });
  const titleRatio = pages.length > 0 ? goodTitles.length / pages.length : 0;

  if (titleRatio === 1) {
    total += 8;
  } else if (titleRatio > 0.75) {
    total += 4;
    findings.push(`${goodTitles.length} of ${pages.length} pages have unique, descriptive titles`);
  } else {
    findings.push(`Only ${goodTitles.length} of ${pages.length} pages have descriptive titles (>10 chars, not just domain name)`);
  }

  // --- Mobile tap targets (8 pts) ---
  const tapTargetIssues = screenshots.flatMap((s) =>
    s.issues.filter((i) => i.description.toLowerCase().includes('tap target') || i.description.toLowerCase().includes('touch target'))
  );
  if (tapTargetIssues.length === 0) {
    total += 8;
  } else {
    findings.push(`${tapTargetIssues.length} tap target issue(s) detected -- mobile users may struggle to interact`);
  }

  // --- Content without JS (5 pts) ---
  const homepageWords = homepage.bodyText.trim().split(/\s+/).filter((w) => w.length > 0).length;
  const hasVideoEmbed = homepage.iframes.some((iframe) => {
    const src = iframe.src.toLowerCase();
    return src.includes('youtube.com') || src.includes('youtu.be') || src.includes('vimeo.com');
  });
  if (homepageWords > 100) {
    total += 5;
  } else if (homepageWords > 50 && hasVideoEmbed) {
    // Lower word count acceptable if video content is embedded
    total += 5;
  } else {
    findings.push(`Homepage has only ${homepageWords} words of visible text -- may rely heavily on JavaScript to render content`);
  }

  // --- Breadcrumbs (3 pts) ---
  const hasBreadcrumbs = pages.some((p) => {
    const body = p.bodyText.toLowerCase();
    return body.includes('breadcrumb') || body.includes('you are here');
  }) || pages.some((p) =>
    p.structuredData.some((sd) => JSON.stringify(sd).toLowerCase().includes('breadcrumb'))
  );

  if (hasBreadcrumbs) {
    total += 3;
  }

  // --- Footer with useful links (5 pts) ---
  const hasFooterLinks = pages.some((p) => {
    const links = p.links.filter((l) => l.isInternal);
    // If a page has many internal links, it likely has a footer with links
    return links.length >= 5;
  });

  if (hasFooterLinks) {
    total += 5;
  }

  const finalScore = Math.max(0, Math.min(100, total));
  const severity = scoreToSeverity(finalScore);
  const { headline, narrative } = generateNarrative('usability', finalScore, findings);

  return {
    category_id: 'usability',
    category_name: 'Usability & Navigation',
    score: finalScore,
    severity,
    headline,
    narrative,
    findings,
  };
}

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    return (u.origin + u.pathname).replace(/\/$/, '').toLowerCase();
  } catch {
    return url.replace(/\/$/, '').toLowerCase();
  }
}

function resolveUrl(base: string, href: string): string {
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}

function scoreToSeverity(score: number): 'critical' | 'serious' | 'moderate' | 'acceptable' | 'strong' {
  if (score <= 40) return 'critical';
  if (score <= 65) return 'serious';
  if (score <= 85) return 'acceptable';
  return 'strong';
}
