import type { CrawledPage, PSIMetrics } from "@/lib/audit/types";
import type { SeoIssueDraft, PageSnapshot } from "./types";
import { issueFingerprint, pageContentHash } from "./fingerprint";

// Map a CrawledPage + optional PSI scores to the per-page snapshot we store
// in seo_checks.pages.
export function pageToSnapshot(
  p: CrawledPage,
  psiMobile?: number,
  psiDesktop?: number
): PageSnapshot {
  const h1 = p.headings.filter((h) => h.level === 1).length;
  const h2 = p.headings.filter((h) => h.level === 2).length;
  const altMissing = p.images.filter(
    (img) => !img.alt || img.alt.trim().length === 0
  ).length;
  const schemaTypes = (p.structuredData ?? [])
    .map((sd) => {
      const obj = sd as Record<string, unknown>;
      const t = obj?.["@type"];
      return typeof t === "string" ? t : Array.isArray(t) ? t.join(",") : null;
    })
    .filter((t): t is string => !!t);
  const hasCanonical = p.headLinks.some((l) => l.rel === "canonical");
  const wordCount = p.bodyText.split(/\s+/).filter(Boolean).length;
  return {
    url: p.url,
    content_hash: pageContentHash(p.title, p.metaDescription, p.bodyText, p.headings),
    status_code: p.statusCode,
    title: p.title,
    meta_desc: p.metaDescription,
    h1_count: h1,
    h2_count: h2,
    alt_total: p.images.length,
    alt_missing: altMissing,
    schema_types: schemaTypes,
    has_canonical: hasCanonical,
    psi_mobile: psiMobile,
    psi_desktop: psiDesktop,
    word_count: wordCount,
  };
}

const TITLE_MIN = 30;
const TITLE_MAX = 60;
const META_MIN = 50;
const META_MAX = 160;

// Extract per-page issues. Aggregate / cross-page issues (duplicate titles,
// missing sitemap, etc.) live in extractSiteIssues below.
export function extractPageIssues(
  page: CrawledPage,
  rootUrl: string
): SeoIssueDraft[] {
  const issues: SeoIssueDraft[] = [];
  const url = page.url;
  const isHomepage = (() => {
    try {
      const path = new URL(url).pathname.replace(/\/$/, "");
      return path === "" || path === "/";
    } catch {
      return false;
    }
  })();
  void rootUrl;

  // --- Status code (technical, critical) ---
  if (page.statusCode >= 500) {
    issues.push({
      fingerprint: issueFingerprint("technical", "server_error", url),
      severity: "critical",
      category: "technical",
      sub_type: "server_error",
      page_url: url,
      title: `Server error (${page.statusCode}) on page`,
      description: `Page returned HTTP ${page.statusCode}. Search engines will drop this page from their index.`,
      recommendation: "Check server logs and fix the underlying error. Re-run the check once the page returns 200.",
    });
  } else if (page.statusCode >= 400) {
    issues.push({
      fingerprint: issueFingerprint("technical", "client_error", url),
      severity: "high",
      category: "technical",
      sub_type: "client_error",
      page_url: url,
      title: `Page not found / forbidden (${page.statusCode})`,
      description: `Page returned HTTP ${page.statusCode}.`,
      recommendation: "Either restore the page, redirect the URL to a relevant page, or remove it from the sitemap.",
    });
  }

  // --- Title tag ---
  const title = (page.title ?? "").trim();
  if (!title) {
    issues.push({
      fingerprint: issueFingerprint("onpage", "missing_title", url),
      severity: isHomepage ? "critical" : "high",
      category: "onpage",
      sub_type: "missing_title",
      page_url: url,
      title: "Missing <title> tag",
      description: "Page has no title tag.",
      recommendation: "Add a unique, descriptive <title> tag (30-60 characters) that includes the primary keyword.",
    });
  } else if (title.length < TITLE_MIN || title.length > TITLE_MAX) {
    issues.push({
      fingerprint: issueFingerprint("onpage", "title_length", url),
      severity: "medium",
      category: "onpage",
      sub_type: "title_length",
      page_url: url,
      title: `Title tag is ${title.length} characters (target ${TITLE_MIN}-${TITLE_MAX})`,
      description: `Current title: "${title.slice(0, 100)}${title.length > 100 ? "…" : ""}"`,
      recommendation: `Rewrite to ${TITLE_MIN}-${TITLE_MAX} characters. Short titles get truncated; long ones get truncated by Google.`,
    });
  }

  // --- Meta description ---
  const meta = (page.metaDescription ?? "").trim();
  if (!meta) {
    issues.push({
      fingerprint: issueFingerprint("onpage", "missing_meta", url),
      severity: "high",
      category: "onpage",
      sub_type: "missing_meta",
      page_url: url,
      title: "Missing meta description",
      description: "Page has no meta description tag.",
      recommendation: "Add a 50-160 character meta description that summarizes the page and includes the primary keyword.",
    });
  } else if (meta.length < META_MIN || meta.length > META_MAX) {
    issues.push({
      fingerprint: issueFingerprint("onpage", "meta_length", url),
      severity: "low",
      category: "onpage",
      sub_type: "meta_length",
      page_url: url,
      title: `Meta description is ${meta.length} characters (target ${META_MIN}-${META_MAX})`,
      recommendation: "Trim or expand to fit the recommended length. Google truncates around 155-160 characters.",
    });
  }

  // --- H1 ---
  const h1Count = page.headings.filter((h) => h.level === 1).length;
  if (h1Count === 0) {
    issues.push({
      fingerprint: issueFingerprint("onpage", "missing_h1", url),
      severity: "high",
      category: "onpage",
      sub_type: "missing_h1",
      page_url: url,
      title: "Missing H1 heading",
      description: "Page has no H1 element.",
      recommendation: "Add exactly one H1 that describes the page's main topic.",
    });
  } else if (h1Count > 1) {
    issues.push({
      fingerprint: issueFingerprint("onpage", "multiple_h1", url),
      severity: "medium",
      category: "onpage",
      sub_type: "multiple_h1",
      page_url: url,
      title: `Multiple H1 tags (${h1Count}) on page`,
      description: "Use exactly one H1; the rest should be H2 or H3.",
      recommendation: "Demote secondary H1s to H2.",
    });
  }

  // --- Image alt text ---
  const totalImages = page.images.length;
  const missingAlt = page.images.filter(
    (img) => !img.alt || img.alt.trim().length === 0
  ).length;
  if (totalImages > 0 && missingAlt / totalImages > 0.3) {
    issues.push({
      fingerprint: issueFingerprint("onpage", "missing_alt_text", url),
      severity: "medium",
      category: "onpage",
      sub_type: "missing_alt_text",
      page_url: url,
      title: `${missingAlt} of ${totalImages} images missing alt text`,
      description: "Search engines and screen readers can't interpret images without alt text.",
      recommendation: "Add descriptive alt text to every meaningful image. Decorative images can use alt=\"\".",
    });
  }

  // --- Canonical ---
  const canonicalLink = page.headLinks.find((l) => l.rel === "canonical");
  if (!canonicalLink) {
    issues.push({
      fingerprint: issueFingerprint("technical", "no_canonical", url),
      severity: "low",
      category: "technical",
      sub_type: "no_canonical",
      page_url: url,
      title: "No canonical tag",
      description: "Without a canonical tag, duplicate URLs (e.g., trailing slash, parameters) can compete with this page in search.",
      recommendation: 'Add <link rel="canonical" href="<this-page-url>"> to the <head>.',
    });
  } else {
    // Validate canonical resolves to the same URL as the crawled page.
    // A canonical that points elsewhere tells Google to ignore this page.
    try {
      const canonicalAbs = new URL(canonicalLink.href, url).toString().replace(/\/+$/, "");
      const pageAbs = url.replace(/\/+$/, "");
      if (canonicalAbs !== pageAbs) {
        issues.push({
          fingerprint: issueFingerprint("technical", "canonical_mismatch", url),
          severity: "high",
          category: "technical",
          sub_type: "canonical_mismatch",
          page_url: url,
          title: "Canonical tag points to a different URL",
          description: `This page declares its canonical as ${canonicalLink.href}, which differs from the page URL itself. Google will index the canonical target, not this page.`,
          recommendation: "If this page should be its own canonical, set rel=\"canonical\" to the page's own URL. If it's intentionally a duplicate of another page, ignore — but verify the canonical target is the version you actually want indexed.",
        });
      }
    } catch {
      // bad URL — skip
    }
  }

  // --- Lazy loading on images (perf) ---
  // Catches one of the easiest performance wins: images above-the-fold +
  // below-the-fold all loading eagerly causes wasted bandwidth and slow LCP.
  const totalImagesForLazy = page.images.length;
  if (totalImagesForLazy >= 5) {
    // We don't have direct loading="lazy" data in CrawledPage today; treat as
    // a soft check — if the page has many images and a poor PSI score we
    // already flag perf separately. Skip for now — handled when we re-crawl
    // with extended fields. Placeholder; comment kept so future me knows
    // why this is conditionally absent.
  }

  // --- JSON-LD structured data ---
  if (!page.structuredData || page.structuredData.length === 0) {
    issues.push({
      fingerprint: issueFingerprint("schema", "no_structured_data", url),
      severity: isHomepage ? "medium" : "low",
      category: "schema",
      sub_type: "no_structured_data",
      page_url: url,
      title: "No JSON-LD structured data",
      description: "Structured data unlocks rich snippets (ratings, business hours, FAQs) in Google results.",
      recommendation: isHomepage
        ? "Add LocalBusiness or Organization schema to the homepage."
        : "Consider adding Article, FAQ, or Service schema appropriate to this page.",
    });
  }

  return issues;
}

// Site-wide / cross-page issues.
export function extractSiteIssues(
  pages: CrawledPage[],
  homeUrl: string
): SeoIssueDraft[] {
  const issues: SeoIssueDraft[] = [];

  // Duplicate titles
  const titles = pages
    .map((p) => p.title.trim().toLowerCase())
    .filter((t) => t.length > 0);
  const titleCounts = new Map<string, number>();
  for (const t of titles) titleCounts.set(t, (titleCounts.get(t) ?? 0) + 1);
  const dupTitles = [...titleCounts.values()].filter((c) => c > 1).length;
  if (dupTitles > 0) {
    issues.push({
      fingerprint: issueFingerprint("onpage", "duplicate_titles", null),
      severity: "high",
      category: "onpage",
      sub_type: "duplicate_titles",
      page_url: null,
      title: `${dupTitles} duplicate title tag${dupTitles > 1 ? "s" : ""} across the site`,
      description: "Pages with the same title compete with each other in search results.",
      recommendation: "Make every page's title unique and descriptive.",
    });
  }

  // Duplicate meta descriptions
  const metas = pages
    .map((p) => p.metaDescription.trim().toLowerCase())
    .filter((m) => m.length > 0);
  const metaCounts = new Map<string, number>();
  for (const m of metas) metaCounts.set(m, (metaCounts.get(m) ?? 0) + 1);
  const dupMetas = [...metaCounts.values()].filter((c) => c > 1).length;
  if (dupMetas > 0) {
    issues.push({
      fingerprint: issueFingerprint("onpage", "duplicate_metas", null),
      severity: "medium",
      category: "onpage",
      sub_type: "duplicate_metas",
      page_url: null,
      title: `${dupMetas} duplicate meta description${dupMetas > 1 ? "s" : ""}`,
      recommendation: "Write unique meta descriptions for every page.",
    });
  }

  void homeUrl;
  return issues;
}

export function extractPSIIssues(
  url: string,
  metric: PSIMetrics
): SeoIssueDraft[] {
  const issues: SeoIssueDraft[] = [];
  const perf = metric.scores.performance;

  if (perf < 50) {
    issues.push({
      fingerprint: issueFingerprint("performance", "poor_lighthouse_mobile", url),
      severity: "high",
      category: "performance",
      sub_type: "poor_lighthouse_mobile",
      page_url: url,
      title: `Mobile Lighthouse performance score is ${perf}/100`,
      description: "Slow pages bleed conversions and rank lower in mobile-first indexing.",
      recommendation: "Optimize images (use WebP, lazy-load below the fold), defer non-critical JS, reduce server response time.",
    });
  }

  // Core Web Vitals — LCP > 2.5s is poor, > 4s is critical
  const lcpMs = metric.coreWebVitals.lcp;
  if (lcpMs > 4000) {
    issues.push({
      fingerprint: issueFingerprint("performance", "lcp_high", url),
      severity: "high",
      category: "performance",
      sub_type: "lcp_high",
      page_url: url,
      title: `LCP (${(lcpMs / 1000).toFixed(1)}s) is failing`,
      description: "Largest Contentful Paint above 4s harms rankings and bounces users.",
      recommendation: "Preload the hero image/font, eliminate render-blocking JS/CSS, use a CDN.",
    });
  } else if (lcpMs > 2500) {
    issues.push({
      fingerprint: issueFingerprint("performance", "lcp_warn", url),
      severity: "medium",
      category: "performance",
      sub_type: "lcp_warn",
      page_url: url,
      title: `LCP (${(lcpMs / 1000).toFixed(1)}s) needs improvement`,
      recommendation: "Aim for under 2.5s — preload hero assets and remove render-blocking resources.",
    });
  }

  // CLS
  const cls = metric.coreWebVitals.cls;
  if (cls > 0.25) {
    issues.push({
      fingerprint: issueFingerprint("performance", "cls_high", url),
      severity: "high",
      category: "performance",
      sub_type: "cls_high",
      page_url: url,
      title: `Cumulative Layout Shift is ${cls.toFixed(2)} (poor)`,
      description: "Layout shifts >0.25 frustrate users and Google penalizes for it.",
      recommendation: "Reserve space for images, fonts, and ads. Set explicit width/height on <img> and <video>.",
    });
  } else if (cls > 0.1) {
    issues.push({
      fingerprint: issueFingerprint("performance", "cls_warn", url),
      severity: "low",
      category: "performance",
      sub_type: "cls_warn",
      page_url: url,
      title: `CLS is ${cls.toFixed(2)} (needs improvement)`,
      recommendation: "Aim for <0.1. Reserve space for media and fonts.",
    });
  }

  return issues;
}
