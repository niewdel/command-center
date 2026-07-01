/**
 * Internal fix-plan generator.
 *
 * Maps every `Finding.code` (see `finding-codes.ts`) to a concrete, technical
 * fix. This is INTERNAL tooling — language here can be as technical as
 * needed (unlike `finding-copy.ts`, which is client-facing plain English).
 *
 * The projection model: `buildFixPlan` always projects to a perfect overall
 * score of 100. Once every finding in a category is fixed, that category is
 * assumed to earn full marks (its `targetScore` is 100), so the weighted
 * average across all categories is 100 by construction. We do NOT compute
 * `currentScore + sum(pointsLost)` — that under-sums because some point
 * losses are "silent bonuses" with no associated finding. Task 10
 * calibration guarantees the scoring model is winnable (fix everything ->
 * 100), so the fix-plan should reflect that promise directly rather than
 * re-deriving it from imperfect point accounting.
 *
 * Coverage of every code in `FINDING_CODES` is enforced by
 * `src/lib/audit/__tests__/fix-coverage.test.ts`.
 */
import { AuditResult, CategoryResult, Finding } from './types';
import type { KnownCode } from './finding-codes';
import { CATEGORY_WEIGHTS } from './scoring';

export interface FixItem {
  finding: string;
  fix: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  impact: string;
  difficulty: 'easy' | 'moderate' | 'advanced';
  timeEstimate: string;
}

export interface CategoryFixPlan {
  category_id: string;
  category_name: string;
  currentScore: number;
  targetScore: number;
  fixes: FixItem[];
}

export interface FixPlan {
  url: string;
  siteName: string;
  auditDate: string;
  currentScore: number;
  projectedScore: number;
  quickWins: FixItem[];
  categories: CategoryFixPlan[];
}

export interface FixCatalogEntry {
  fix: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  difficulty: 'easy' | 'moderate' | 'advanced';
  timeEstimate: string;
}

// --- Code -> fix catalog -----------------------------------------------
//
// Every code in FINDING_CODES must have an entry here. Grouped by
// namespace to mirror finding-codes.ts / finding-copy.ts.

const FIX_CATALOG: Record<KnownCode, FixCatalogEntry> = {
  // -----------------------------------------------------------------
  // seo.* -- SEO Fundamentals
  // -----------------------------------------------------------------
  'seo.title.missing': {
    fix: 'Add unique `<title>` tags to every page. Format: "Primary Keyword - Secondary Keyword | Brand Name". Keep under 60 characters.',
    priority: 'critical',
    difficulty: 'easy',
    timeEstimate: '30 minutes per page',
  },
  'seo.title.duplicate': {
    fix: 'Write unique title tags for each page. Each title should reflect that specific page\'s content and target keywords.',
    priority: 'high',
    difficulty: 'easy',
    timeEstimate: '1 hour',
  },
  'seo.pages.none': {
    fix: 'The crawler returned zero pages. Verify robots.txt / WAF / firewall rules are not blocking the crawler user agent, confirm the site returns HTTP 200 (not 4xx/5xx or a redirect loop), and check whether the homepage requires JS to render any content.',
    priority: 'critical',
    difficulty: 'advanced',
    timeEstimate: '1-2 hours',
  },
  'seo.title.coverage.partial': {
    fix: 'Add a unique `<title>` tag to each page that is currently missing one.',
    priority: 'high',
    difficulty: 'easy',
    timeEstimate: '1-2 hours',
  },
  'seo.title.duplicate.partial': {
    fix: 'Rewrite the small set of pages sharing a title tag so each has a unique, page-specific title.',
    priority: 'medium',
    difficulty: 'easy',
    timeEstimate: '1 hour',
  },
  'seo.meta.coverage.partial': {
    fix: 'Add a `<meta name="description">` tag (150-160 characters) to each page currently missing one.',
    priority: 'medium',
    difficulty: 'easy',
    timeEstimate: '1-2 hours',
  },
  'seo.meta.coverage.missing': {
    fix: 'Write meta descriptions for every page (150-160 characters). Include a call-to-action and target keywords.',
    priority: 'high',
    difficulty: 'easy',
    timeEstimate: '2-4 hours',
  },
  'seo.meta.duplicate.partial': {
    fix: 'Rewrite the small set of pages sharing a meta description so each summarizes that specific page\'s content.',
    priority: 'medium',
    difficulty: 'easy',
    timeEstimate: '1 hour',
  },
  'seo.meta.duplicate': {
    fix: 'Write unique meta descriptions for each page that summarize the specific page content.',
    priority: 'high',
    difficulty: 'easy',
    timeEstimate: '1-2 hours',
  },
  'seo.h1.issues.partial': {
    fix: 'Fix the pages missing an H1 (or with more than one) so each page has exactly one H1 containing its primary keyword.',
    priority: 'medium',
    difficulty: 'easy',
    timeEstimate: '1 hour',
  },
  'seo.h1.issues.severe': {
    fix: 'Ensure every page has exactly one H1 tag with a unique, descriptive title. The H1 should describe the page\'s primary topic and contain its primary keyword.',
    priority: 'high',
    difficulty: 'easy',
    timeEstimate: '2-4 hours',
  },
  'seo.heading.hierarchy.skipped': {
    fix: 'Fix heading levels to flow logically: H1 -> H2 -> H3. Don\'t skip from H1 to H3. Use CSS for visual sizing instead of heading levels.',
    priority: 'medium',
    difficulty: 'easy',
    timeEstimate: '1 hour',
  },
  'seo.image.alt.partial': {
    fix: 'Add descriptive alt text to the images currently missing it. Describe what the image shows in context of the page content.',
    priority: 'medium',
    difficulty: 'easy',
    timeEstimate: '1-2 hours',
  },
  'seo.image.alt.missing': {
    fix: 'Add descriptive alt text to every image site-wide. Describe what the image shows in context of the page content.',
    priority: 'high',
    difficulty: 'easy',
    timeEstimate: '2-4 hours',
  },
  'seo.sitemap.missing': {
    fix: 'Generate an XML sitemap (most CMS platforms/frameworks do this automatically, e.g. `next-sitemap`) and submit it to Google Search Console.',
    priority: 'high',
    difficulty: 'easy',
    timeEstimate: '30 minutes',
  },
  'seo.robots.missing': {
    fix: 'Add a /robots.txt with at minimum `User-agent: *`, `Allow: /`, and a `Sitemap:` line pointing at the XML sitemap.',
    priority: 'medium',
    difficulty: 'easy',
    timeEstimate: '15 minutes',
  },
  'seo.canonical.missing': {
    fix: 'Add `<link rel="canonical" href="https://domain.com/page-url">` to every page\'s `<head>` to prevent duplicate-content issues.',
    priority: 'medium',
    difficulty: 'easy',
    timeEstimate: '1 hour',
  },
  'seo.structureddata.missing': {
    fix: 'Add JSON-LD structured data for the business type (LocalBusiness, Organization, etc.) using Google\'s Structured Data Markup Helper or schema.org templates.',
    priority: 'high',
    difficulty: 'moderate',
    timeEstimate: '1-2 hours',
  },
  'seo.opengraph.missing': {
    fix: 'Add Open Graph tags to the homepage: og:title, og:description, og:image, og:url, og:type.',
    priority: 'medium',
    difficulty: 'easy',
    timeEstimate: '30 minutes',
  },
  'seo.orphan.pages': {
    fix: 'Add internal links pointing to orphaned pages from related content pages so every page has at least 2-3 inbound internal links.',
    priority: 'medium',
    difficulty: 'easy',
    timeEstimate: '1 hour',
  },
  'seo.title.length': {
    fix: 'Adjust title tags to 30-60 characters. Too short wastes keyword opportunity; too long gets truncated in search results.',
    priority: 'medium',
    difficulty: 'easy',
    timeEstimate: '1 hour',
  },

  // -----------------------------------------------------------------
  // perf.* -- Performance & Speed
  // -----------------------------------------------------------------
  'perf.psi.unavailable': {
    fix: 'Investigate why PageSpeed Insights couldn\'t analyze the site. Common causes: server timeouts, aggressive rate limiting/bot blocking, or auth walls in front of the tested URL.',
    priority: 'critical',
    difficulty: 'advanced',
    timeEstimate: '1-2 hours',
  },
  'perf.lighthouse.needsimprovement': {
    fix: 'Run Lighthouse in Chrome DevTools and address the top opportunities: image compression, code splitting, removing unused CSS/JS.',
    priority: 'medium',
    difficulty: 'moderate',
    timeEstimate: '2-4 hours',
  },
  'perf.lighthouse.poor': {
    fix: 'Run Lighthouse in Chrome DevTools, address the top opportunities it identifies: image compression, code splitting, removing unused CSS/JS.',
    priority: 'high',
    difficulty: 'advanced',
    timeEstimate: 'half day',
  },
  'perf.lighthouse.verypoor': {
    fix: 'Prioritize a full performance pass: compress/lazy-load images, code-split JS bundles, remove unused CSS/JS, enable caching/CDN. Re-run Lighthouse after each change.',
    priority: 'critical',
    difficulty: 'advanced',
    timeEstimate: 'half day',
  },
  'perf.lcp.slow': {
    fix: 'Optimize the largest above-fold element (usually a hero image). Compress images, use WebP/AVIF, add width/height attributes, and preload the hero image with `<link rel="preload">`.',
    priority: 'high',
    difficulty: 'moderate',
    timeEstimate: '2-4 hours',
  },
  'perf.lcp.verypoor': {
    fix: 'Preload and compress the largest contentful element, remove render-blocking resources above it, and consider serving it from a CDN edge closer to users.',
    priority: 'critical',
    difficulty: 'moderate',
    timeEstimate: '2-4 hours',
  },
  'perf.fcp.slow': {
    fix: 'Reduce server response time (TTFB), inline critical CSS, defer non-essential JavaScript, and use `font-display: swap` for web fonts.',
    priority: 'high',
    difficulty: 'advanced',
    timeEstimate: '2-4 hours',
  },
  'perf.fcp.verypoor': {
    fix: 'Audit server/CDN response time first (TTFB), then inline critical CSS and defer all non-essential JS/fonts so something paints immediately.',
    priority: 'critical',
    difficulty: 'advanced',
    timeEstimate: '2-4 hours',
  },
  'perf.cls.high': {
    fix: 'Add explicit width/height attributes to all images and embeds. Reserve space for ads/dynamic content. Use CSS `aspect-ratio`.',
    priority: 'high',
    difficulty: 'moderate',
    timeEstimate: '1-2 hours',
  },
  'perf.cls.veryhigh': {
    fix: 'Audit every image, embed, and dynamically-injected element (ads, banners, font swaps) and reserve their layout space up front with explicit dimensions or `aspect-ratio`.',
    priority: 'high',
    difficulty: 'moderate',
    timeEstimate: '2-4 hours',
  },
  'perf.tbt.high': {
    fix: 'Reduce JavaScript execution time. Defer non-critical scripts, code-split large bundles, and remove unused JavaScript. Use `async`/`defer` on script tags.',
    priority: 'high',
    difficulty: 'advanced',
    timeEstimate: 'half day',
  },
  'perf.tbt.veryhigh': {
    fix: 'Aggressively code-split and defer JS. Move third-party scripts (analytics, chat widgets) to load after interactive, and audit for long main-thread tasks with the Performance panel.',
    priority: 'critical',
    difficulty: 'advanced',
    timeEstimate: 'half day',
  },
  'perf.speedindex.slow': {
    fix: 'Optimize the critical rendering path: inline above-fold CSS, defer below-fold resources, preload key assets.',
    priority: 'high',
    difficulty: 'advanced',
    timeEstimate: 'half day',
  },
  'perf.speedindex.veryslow': {
    fix: 'Minimize render-blocking resources entirely: inline critical CSS, defer everything else, preload hero assets, and consider server-side rendering if the page is client-rendered.',
    priority: 'critical',
    difficulty: 'advanced',
    timeEstimate: 'half day',
  },
  'perf.page.below50': {
    fix: 'Identify the specific page(s) scoring below 50 in PageSpeed Insights and address their bottlenecks individually — they may differ from the site-wide pattern.',
    priority: 'high',
    difficulty: 'moderate',
    timeEstimate: '2-4 hours',
  },
  'perf.pageweight.high': {
    fix: 'Audit the homepage payload (Network tab) and cut unnecessary weight: compress/resize images, remove unused JS/CSS bundles, lazy-load below-fold assets.',
    priority: 'medium',
    difficulty: 'moderate',
    timeEstimate: '2-4 hours',
  },
  'perf.variance.high': {
    fix: 'Profile the slowest pages individually with PageSpeed Insights — inconsistent performance usually means a template, third-party script, or unoptimized asset is only present on some pages.',
    priority: 'high',
    difficulty: 'moderate',
    timeEstimate: '2-4 hours',
  },

  // -----------------------------------------------------------------
  // visual.* -- Visual Design & Branding
  // -----------------------------------------------------------------
  'visual.pages.none': {
    fix: 'The crawler couldn\'t read any pages, so visual design couldn\'t be assessed. Fix the same crawl-blocking issue described for `seo.pages.none` before re-running the audit.',
    priority: 'critical',
    difficulty: 'advanced',
    timeEstimate: '1-2 hours',
  },
  'visual.viewport.missing': {
    fix: 'Add `<meta name="viewport" content="width=device-width, initial-scale=1.0">` to every page\'s `<head>`.',
    priority: 'critical',
    difficulty: 'easy',
    timeEstimate: '15 minutes',
  },
  'visual.favicon.missing': {
    fix: 'Create a 32x32 and 16x16 favicon. Add `<link rel="icon" href="/favicon.ico">` to `<head>`. Use realfavicongenerator.net for all sizes.',
    priority: 'high',
    difficulty: 'easy',
    timeEstimate: '30 minutes',
  },
  'visual.fonts.missing': {
    fix: 'Choose a professional font pairing (e.g., Montserrat + Inter) from Google Fonts. Add the `<link>` tag to `<head>` and update CSS font-family declarations.',
    priority: 'medium',
    difficulty: 'easy',
    timeEstimate: '1 hour',
  },
  'visual.images.homepage.none': {
    fix: 'Add professional hero imagery, team photos, or service photos to the homepage. Use high-quality stock from Unsplash or professional photography.',
    priority: 'high',
    difficulty: 'moderate',
    timeEstimate: '2-4 hours',
  },
  'visual.images.unique.low': {
    fix: 'Add relevant images throughout the site — service photos, team photos, location shots, before/after images. Aim for 3-5 images per page.',
    priority: 'medium',
    difficulty: 'moderate',
    timeEstimate: '2-4 hours',
  },
  'visual.images.responsive.missing': {
    fix: 'Add `srcset` attributes to images or use the `<picture>` element for different screen sizes. Use tools like Squoosh to generate multiple sizes.',
    priority: 'medium',
    difficulty: 'moderate',
    timeEstimate: '2-4 hours',
  },
  'visual.h1.partial': {
    fix: 'Add a single, descriptive H1 to the pages currently missing one.',
    priority: 'medium',
    difficulty: 'easy',
    timeEstimate: '1 hour',
  },
  'visual.h1.missing': {
    fix: 'Ensure every page has exactly one H1 tag with a unique, descriptive page title. The H1 should describe the page\'s primary topic.',
    priority: 'high',
    difficulty: 'easy',
    timeEstimate: '2-4 hours',
  },
  'visual.alt.partial': {
    fix: 'Add descriptive alt text to the images currently missing it.',
    priority: 'medium',
    difficulty: 'easy',
    timeEstimate: '1 hour',
  },
  'visual.alt.missing': {
    fix: 'Add descriptive alt text to every image. Describe what the image shows in context of the page content.',
    priority: 'high',
    difficulty: 'easy',
    timeEstimate: '2-4 hours',
  },
  'visual.ogimage.missing': {
    fix: 'Add Open Graph image meta tags: `<meta property="og:image" content="url-to-image.jpg">`. Create a branded 1200x630 share image.',
    priority: 'medium',
    difficulty: 'moderate',
    timeEstimate: '1-2 hours',
  },
  'visual.imageformats.legacy': {
    fix: 'Convert images to WebP/AVIF using tools like Squoosh, Sharp, or your CMS\'s built-in optimizer. WebP provides 25-35% smaller files than JPEG/PNG.',
    priority: 'medium',
    difficulty: 'moderate',
    timeEstimate: '1-2 hours',
  },
  'visual.brokenimages.minor': {
    fix: 'Fix or replace the broken image URLs. Check for typos in `src` attributes, missing files, or moved assets.',
    priority: 'medium',
    difficulty: 'easy',
    timeEstimate: '30 minutes',
  },
  'visual.brokenimages.severe': {
    fix: 'Run a site-wide link/image checker (e.g. Screaming Frog) to find every broken image and fix or replace each one.',
    priority: 'critical',
    difficulty: 'easy',
    timeEstimate: '1-2 hours',
  },

  // -----------------------------------------------------------------
  // usability.* -- Usability & Navigation
  // -----------------------------------------------------------------
  'usability.pages.none': {
    fix: 'The crawler couldn\'t read any pages, so usability couldn\'t be assessed. Fix the same crawl-blocking issue described for `seo.pages.none` before re-running the audit.',
    priority: 'critical',
    difficulty: 'advanced',
    timeEstimate: '1-2 hours',
  },
  'usability.nav.semantic.missing': {
    fix: 'Wrap the main navigation in a `<nav>` element. Use `<ul>/<li>` for nav items. Add `role="navigation"` as a fallback for older markup.',
    priority: 'high',
    difficulty: 'easy',
    timeEstimate: '30 minutes',
  },
  'usability.nav.missing': {
    fix: 'Add a semantic `<nav>` element with links to the site\'s main sections on the homepage.',
    priority: 'high',
    difficulty: 'easy',
    timeEstimate: '30 minutes',
  },
  'usability.nav.coverage.partial': {
    fix: 'Ensure the shared navigation component/partial is included on the pages currently missing it.',
    priority: 'high',
    difficulty: 'moderate',
    timeEstimate: '1-2 hours',
  },
  'usability.nav.coverage.missing': {
    fix: 'Ensure the same navigation menu appears on every page. Use a shared header/nav component or template partial rather than hand-copying markup per page.',
    priority: 'high',
    difficulty: 'moderate',
    timeEstimate: '1-2 hours',
  },
  'usability.clickdepth.partial': {
    fix: 'Add direct links from the homepage or main nav to the pages currently 3+ clicks deep so every page is reachable within 2 clicks.',
    priority: 'medium',
    difficulty: 'moderate',
    timeEstimate: '1-2 hours',
  },
  'usability.clickdepth.severe': {
    fix: 'Flatten the site structure. Add important pages directly to the main navigation. Add a sitemap page or footer navigation listing all key pages.',
    priority: 'high',
    difficulty: 'moderate',
    timeEstimate: '2-4 hours',
  },
  'usability.brokenlinks.minor': {
    fix: 'Use a tool like Screaming Frog or Dead Link Checker to find the broken links and fix or remove each one.',
    priority: 'medium',
    difficulty: 'easy',
    timeEstimate: '1 hour',
  },
  'usability.brokenlinks.severe': {
    fix: 'Run a full-site crawl with Screaming Frog or Dead Link Checker, then fix or remove every broken link and update any links to pages that have moved.',
    priority: 'critical',
    difficulty: 'easy',
    timeEstimate: '1-2 hours',
  },
  'usability.internallinks.moderate': {
    fix: 'Add contextual internal links within page content. Link related pages together with "Related Services" or "Learn More" sections.',
    priority: 'medium',
    difficulty: 'moderate',
    timeEstimate: '2-4 hours',
  },
  'usability.internallinks.weak': {
    fix: 'Add contextual internal links within page content. Aim for 5+ internal links per page linking to related pages.',
    priority: 'high',
    difficulty: 'moderate',
    timeEstimate: '2-4 hours',
  },
  'usability.skipnav.missing': {
    fix: 'Add a skip-nav link as the first element in `<body>`: `<a href="#main" class="skip-link">Skip to main content</a>`. Style it to appear only on focus.',
    priority: 'medium',
    difficulty: 'easy',
    timeEstimate: '30 minutes',
  },
  'usability.a11y.partial': {
    fix: 'Run axe DevTools in Chrome and fix the flagged violations: form labels, color contrast, ARIA attributes on interactive elements.',
    priority: 'medium',
    difficulty: 'moderate',
    timeEstimate: '1-2 hours',
  },
  'usability.a11y.severe': {
    fix: 'Run axe DevTools (or a full WAVE/Lighthouse accessibility audit) and fix all critical/serious violations: missing form labels, insufficient color contrast, missing ARIA attributes on interactive elements, keyboard traps.',
    priority: 'critical',
    difficulty: 'moderate',
    timeEstimate: '2-4 hours',
  },
  'usability.titles.partial': {
    fix: 'Rewrite the generic/short page titles into unique, descriptive titles (50-60 characters). Format: "Page Topic | Brand Name".',
    priority: 'medium',
    difficulty: 'easy',
    timeEstimate: '1 hour',
  },
  'usability.titles.poor': {
    fix: 'Write unique, descriptive title tags for each page (50-60 characters). Format: "Page Topic | Brand Name".',
    priority: 'high',
    difficulty: 'easy',
    timeEstimate: '2-4 hours',
  },
  'usability.taptargets.issues': {
    fix: 'Increase the size of clickable elements to at least 44x44px on mobile. Add padding to links and buttons that are too close together.',
    priority: 'high',
    difficulty: 'easy',
    timeEstimate: '1 hour',
  },
  'usability.content.jsdependent': {
    fix: 'Server-render (or statically generate) the homepage\'s core content so it\'s present in the initial HTML response rather than requiring client-side JS to populate it. Verify with "View Source" / disable JS.',
    priority: 'high',
    difficulty: 'advanced',
    timeEstimate: 'half day',
  },

  // -----------------------------------------------------------------
  // aeo.* -- AI-search / answer-engine optimization
  // -----------------------------------------------------------------
  'aeo.schema.absent': {
    fix: 'Add LocalBusiness/Organization JSON-LD schema to the homepage with name, address, phone, hours, and logo.',
    priority: 'high',
    difficulty: 'moderate',
    timeEstimate: '1-2 hours',
  },
  'aeo.schema.coverage.low': {
    fix: 'Add appropriate JSON-LD schema (Article, Service, FAQPage, etc.) to the pages currently missing it so schema coverage exceeds half the site.',
    priority: 'medium',
    difficulty: 'moderate',
    timeEstimate: '2-4 hours',
  },
  'aeo.entity.schema.missing': {
    fix: 'Add Organization/LocalBusiness JSON-LD with explicit `name`, `address`, and `telephone` properties so crawlers can confirm the business entity.',
    priority: 'high',
    difficulty: 'moderate',
    timeEstimate: '1 hour',
  },
  'aeo.faq.absent': {
    fix: 'Add an FAQ section (with matching `FAQPage` JSON-LD) answering the top questions prospective customers ask.',
    priority: 'medium',
    difficulty: 'moderate',
    timeEstimate: '2-4 hours',
  },
  'aeo.headings.notquestions': {
    fix: 'Rewrite a handful of section headings as questions (e.g. "How much does X cost?") that mirror how people phrase voice/AI search queries.',
    priority: 'medium',
    difficulty: 'easy',
    timeEstimate: '1 hour',
  },
  'aeo.content.notanswerfirst': {
    fix: 'Restructure body copy so the first sentence under each heading directly answers it, before elaborating. AI answer engines quote this pattern most often.',
    priority: 'medium',
    difficulty: 'moderate',
    timeEstimate: '1-2 hours',
  },
  'aeo.llms.absent': {
    fix: 'Add an `/llms.txt` file at the site root summarizing the business, services, and key pages for AI crawlers (see llmstxt.org for the spec).',
    priority: 'medium',
    difficulty: 'easy',
    timeEstimate: '1 hour',
  },
  'aeo.entity.sameas.missing': {
    fix: 'Add a `sameAs` array to the Organization/LocalBusiness schema linking to the business\'s social media and directory profiles (LinkedIn, Facebook, Google Business Profile).',
    priority: 'medium',
    difficulty: 'easy',
    timeEstimate: '30 minutes',
  },
  'aeo.nap.inconsistent': {
    fix: 'Audit every page (and schema) for the business Name/Address/Phone and make them byte-for-byte identical everywhere, including Google Business Profile.',
    priority: 'high',
    difficulty: 'moderate',
    timeEstimate: '1-2 hours',
  },
  'aeo.freshness.absent': {
    fix: 'Add a visible "last updated" date or current-year reference to key pages, and keep it current going forward.',
    priority: 'low',
    difficulty: 'easy',
    timeEstimate: '30 minutes',
  },
  'aeo.aicrawlers.blocked': {
    fix: 'Update `robots.txt` to explicitly allow AI crawlers (GPTBot, ClaudeBot, PerplexityBot, Google-Extended, etc.) unless there\'s a deliberate business reason to block them.',
    priority: 'critical',
    difficulty: 'easy',
    timeEstimate: '15 minutes',
  },
  'aeo.headings.structure': {
    fix: 'Ensure the homepage has exactly one clear, descriptive H1 stating the primary topic/offer.',
    priority: 'medium',
    difficulty: 'easy',
    timeEstimate: '30 minutes',
  },
  'aeo.summary.absent': {
    fix: 'Add a concise `<meta name="description">` (or an explicit summary paragraph) to the homepage that AI tools can lift as a description.',
    priority: 'medium',
    difficulty: 'easy',
    timeEstimate: '30 minutes',
  },

  // -----------------------------------------------------------------
  // cta.* -- Calls to Action
  // -----------------------------------------------------------------
  'cta.pages.none': {
    fix: 'The crawler couldn\'t read any pages, so CTAs couldn\'t be assessed. Fix the same crawl-blocking issue described for `seo.pages.none` before re-running the audit.',
    priority: 'critical',
    difficulty: 'advanced',
    timeEstimate: '1-2 hours',
  },
  'cta.homepage.missing': {
    fix: 'Add a prominent call-to-action button above the fold on the homepage. Use action-oriented text like "Get a Free Quote", "Schedule a Call", or "Contact Us Today".',
    priority: 'critical',
    difficulty: 'easy',
    timeEstimate: '30 minutes',
  },
  'cta.keywords.none': {
    fix: 'Add inviting action words ("Contact", "Schedule", "Get Started", "Request a Quote") to buttons/links across the site.',
    priority: 'high',
    difficulty: 'easy',
    timeEstimate: '1 hour',
  },
  'cta.keywords.few': {
    fix: 'Diversify CTAs across the site. Use different action words: "Get Started", "Book a Call", "Request a Quote", "Learn More", "See Pricing".',
    priority: 'medium',
    difficulty: 'easy',
    timeEstimate: '1 hour',
  },
  'cta.form.pagelinked': {
    fix: 'Confirm the linked contact/form page actually renders a working, submittable form (not just a mailto link or static text) and fix it if not.',
    priority: 'medium',
    difficulty: 'moderate',
    timeEstimate: '1 hour',
  },
  'cta.form.missing': {
    fix: 'Add a contact form with name, email, phone, and message fields. Use a form service like HubSpot, Typeform, or JotForm if there\'s no server-side form handling.',
    priority: 'critical',
    difficulty: 'moderate',
    timeEstimate: '1-2 hours',
  },
  'cta.phone.nothomepage': {
    fix: 'Add the clickable phone number to the homepage header/footer, not just interior pages. Use `<a href="tel:+1234567890">` for mobile tap-to-call.',
    priority: 'high',
    difficulty: 'easy',
    timeEstimate: '15 minutes',
  },
  'cta.phone.missing': {
    fix: 'Add a clickable phone number in the header and footer of every page. Use `<a href="tel:+1234567890">` for mobile tap-to-call.',
    priority: 'critical',
    difficulty: 'easy',
    timeEstimate: '15 minutes',
  },
  'cta.email.nothomepage': {
    fix: 'Add the clickable email address to the homepage header/footer, not just interior pages. Use `<a href="mailto:info@domain.com">`.',
    priority: 'medium',
    difficulty: 'easy',
    timeEstimate: '15 minutes',
  },
  'cta.email.missing': {
    fix: 'Add a clickable email address in the header/footer and contact page. Use `<a href="mailto:info@domain.com">`.',
    priority: 'high',
    difficulty: 'easy',
    timeEstimate: '15 minutes',
  },
  'cta.paths.partial': {
    fix: 'Add whichever contact path (form, phone, or email) is currently missing so all three are available site-wide.',
    priority: 'high',
    difficulty: 'moderate',
    timeEstimate: '1 hour',
  },
  'cta.paths.single': {
    fix: 'Add at least two more contact paths beyond the current single option — offer visitors a form, phone number, and email.',
    priority: 'high',
    difficulty: 'moderate',
    timeEstimate: '1-2 hours',
  },
  'cta.paths.none': {
    fix: 'Add at minimum a contact form, a clickable phone number, and a clickable email address.',
    priority: 'critical',
    difficulty: 'moderate',
    timeEstimate: '1-2 hours',
  },
  'cta.coverage.partial': {
    fix: 'Add a relevant CTA to the pages currently missing one, not just the homepage.',
    priority: 'high',
    difficulty: 'easy',
    timeEstimate: '1-2 hours',
  },
  'cta.coverage.missing': {
    fix: 'Add CTAs to every page, not just the homepage. Each service page should have its own relevant CTA.',
    priority: 'high',
    difficulty: 'easy',
    timeEstimate: '2-4 hours',
  },
  'cta.contactpage.missing': {
    fix: 'Create a standalone `/contact` page with a form, phone number, email, physical address, and a map embed.',
    priority: 'high',
    difficulty: 'moderate',
    timeEstimate: '1-2 hours',
  },
  'cta.language.weak': {
    fix: 'Replace generic button/link copy ("click here", "submit") with specific, action-oriented language ("Get Your Free Quote", "Book a Call").',
    priority: 'medium',
    difficulty: 'easy',
    timeEstimate: '1 hour',
  },

  // -----------------------------------------------------------------
  // trust.* -- Trust & Credibility
  // -----------------------------------------------------------------
  'trust.pages.none': {
    fix: 'The crawler couldn\'t read any pages, so trust signals couldn\'t be assessed. Fix the same crawl-blocking issue described for `seo.pages.none` before re-running the audit.',
    priority: 'critical',
    difficulty: 'advanced',
    timeEstimate: '1-2 hours',
  },
  'trust.https.missing': {
    fix: 'Install an SSL certificate (free from Let\'s Encrypt) and redirect all HTTP traffic to HTTPS. Most hosts provide one-click SSL setup.',
    priority: 'critical',
    difficulty: 'easy',
    timeEstimate: '30 minutes',
  },
  'trust.privacypolicy.missing': {
    fix: 'Add a privacy policy page. Use a free generator like TermsFeed or Termly, then customize for the business. Link to it in the footer.',
    priority: 'critical',
    difficulty: 'easy',
    timeEstimate: '1 hour',
  },
  'trust.terms.missing': {
    fix: 'Add a Terms of Service page. Use a template generator and customize. Link in the footer alongside the privacy policy.',
    priority: 'medium',
    difficulty: 'easy',
    timeEstimate: '1 hour',
  },
  'trust.contactpage.missing': {
    fix: 'Create a dedicated `/contact` page with the phone number, email, physical address, business hours, and a contact form.',
    priority: 'critical',
    difficulty: 'easy',
    timeEstimate: '1-2 hours',
  },
  'trust.address.missing': {
    fix: 'Add the business address to the footer and contact page (a P.O. box or virtual office if home-based). Critical for local SEO trust signals.',
    priority: 'high',
    difficulty: 'easy',
    timeEstimate: '15 minutes',
  },
  'trust.social.none': {
    fix: 'Create profiles on relevant platforms (at minimum: Google Business Profile, LinkedIn, Facebook) and add social icon links to the header/footer.',
    priority: 'high',
    difficulty: 'easy',
    timeEstimate: '1 hour',
  },
  'trust.social.partial': {
    fix: 'Fill out the missing major social profiles (Google Business Profile, LinkedIn, Facebook) and link all of them from the site.',
    priority: 'medium',
    difficulty: 'easy',
    timeEstimate: '30 minutes',
  },
  'trust.testimonials.missing': {
    fix: 'Add a testimonials section with real client quotes, names, and photos where possible. Add Google/Yelp review widgets and ask satisfied clients for written testimonials.',
    priority: 'critical',
    difficulty: 'moderate',
    timeEstimate: '2-4 hours',
  },
  'trust.schema.missing': {
    fix: 'Add LocalBusiness or Organization JSON-LD schema to the homepage. Include name, address, phone, hours, and logo.',
    priority: 'high',
    difficulty: 'moderate',
    timeEstimate: '1-2 hours',
  },
  'trust.aboutpage.missing': {
    fix: 'Create an About page with the company story, team bios, mission, and credentials.',
    priority: 'high',
    difficulty: 'moderate',
    timeEstimate: '2-4 hours',
  },

  // -----------------------------------------------------------------
  // content.* -- Content Quality
  // -----------------------------------------------------------------
  'content.pages.none': {
    fix: 'The crawler couldn\'t read any pages, so content couldn\'t be assessed. Fix the same crawl-blocking issue described for `seo.pages.none` before re-running the audit.',
    priority: 'critical',
    difficulty: 'advanced',
    timeEstimate: '1-2 hours',
  },
  'content.homepage.words.moderate': {
    fix: 'Expand the homepage to at least 500 words: value proposition, key services, social proof, and a clear CTA.',
    priority: 'medium',
    difficulty: 'moderate',
    timeEstimate: '1-2 hours',
  },
  'content.homepage.words.thin': {
    fix: 'Expand homepage content to 500+ words. Include the value proposition, key services, social proof, and a clear CTA. Don\'t rely solely on images and one-liners.',
    priority: 'high',
    difficulty: 'moderate',
    timeEstimate: '2-4 hours',
  },
  'content.homepage.words.severelythin': {
    fix: 'Rewrite the homepage from near-empty to a full page: value proposition, services overview, social proof, FAQ, and a clear CTA.',
    priority: 'critical',
    difficulty: 'moderate',
    timeEstimate: '2-4 hours',
  },
  'content.avgwords.below': {
    fix: 'Expand thinner-than-average pages with more useful, original content — details, FAQs, or service descriptions.',
    priority: 'medium',
    difficulty: 'moderate',
    timeEstimate: '1-2 hours per page',
  },
  'content.avgwords.thin': {
    fix: 'Expand most pages to at least 300 words of useful, original content each. Add relevant information, FAQs, or detailed descriptions of services/products.',
    priority: 'high',
    difficulty: 'moderate',
    timeEstimate: '1-2 hours per page',
  },
  'content.thinpages.one': {
    fix: 'Expand the identified thin page to at least 300 words of useful, original content.',
    priority: 'medium',
    difficulty: 'moderate',
    timeEstimate: '1-2 hours',
  },
  'content.thinpages.many': {
    fix: 'Expand each thin page to at least 300 words of useful, original content. Prioritize the highest-traffic pages first.',
    priority: 'high',
    difficulty: 'moderate',
    timeEstimate: '1-2 hours per page',
  },
  'content.titles.duplicate': {
    fix: 'Write unique titles for each page. Duplicate titles signal to search engines that pages may have duplicate content.',
    priority: 'high',
    difficulty: 'easy',
    timeEstimate: '1 hour',
  },
  'content.emptypages.one': {
    fix: 'Either add meaningful content to the empty page or remove/301-redirect it.',
    priority: 'critical',
    difficulty: 'easy',
    timeEstimate: '1 hour',
  },
  'content.emptypages.many': {
    fix: 'For each essentially-blank page, either add meaningful content or remove/301-redirect it. Empty pages hurt SEO and waste visitors\' time.',
    priority: 'critical',
    difficulty: 'easy',
    timeEstimate: '1 hour per page',
  },
  'content.brokenimages': {
    fix: 'Use a link/image checker (Screaming Frog) to find every broken image across the site, then fix or replace each one.',
    priority: 'high',
    difficulty: 'easy',
    timeEstimate: '1-2 hours',
  },
  'content.blog.missing': {
    fix: 'Start a blog or news section. Publish 2-4 articles per month on topics customers search for. This drives organic traffic and establishes authority.',
    priority: 'medium',
    difficulty: 'advanced',
    timeEstimate: 'ongoing',
  },
  'content.freshness.missing': {
    fix: 'Add a visible current-year reference or "last updated" date to key pages (e.g. copyright footer, blog posts) and keep it current going forward.',
    priority: 'low',
    difficulty: 'easy',
    timeEstimate: '15 minutes',
  },
  'content.ratio.thin': {
    fix: 'Add more substantive written content to most pages — most currently have too little text relative to the rest of the page.',
    priority: 'high',
    difficulty: 'moderate',
    timeEstimate: '2-4 hours',
  },
  'content.meta.thin': {
    fix: 'Write proper meta descriptions of 120-160 characters that summarize the page content and include a call-to-action, for the pages currently missing a solid one.',
    priority: 'medium',
    difficulty: 'easy',
    timeEstimate: '1-2 hours',
  },
  'content.depth.limited': {
    fix: 'Add more pages to the site covering services, FAQ, about/team, process, case studies, and service areas.',
    priority: 'medium',
    difficulty: 'moderate',
    timeEstimate: 'ongoing',
  },

  // -----------------------------------------------------------------
  // conversion.* -- Conversion Architecture
  // -----------------------------------------------------------------
  'conversion.pages.none': {
    fix: 'The crawler couldn\'t read any pages, so conversion architecture couldn\'t be assessed. Fix the same crawl-blocking issue described for `seo.pages.none` before re-running the audit.',
    priority: 'critical',
    difficulty: 'advanced',
    timeEstimate: '1-2 hours',
  },
  'conversion.forms.none': {
    fix: 'Add at least one contact/inquiry form to the site. Keep it simple: name, email, phone, message. Use a service like HubSpot (free) or Typeform.',
    priority: 'critical',
    difficulty: 'moderate',
    timeEstimate: '1-2 hours',
  },
  'conversion.form.fields.moderate': {
    fix: 'Trim the form to the essential fields only — every extra field reduces completion rate.',
    priority: 'medium',
    difficulty: 'easy',
    timeEstimate: '30 minutes',
  },
  'conversion.form.fields.excessive': {
    fix: 'Simplify the form to 5 or fewer fields. Only ask for what\'s truly needed upfront — gather more info after initial contact.',
    priority: 'high',
    difficulty: 'easy',
    timeEstimate: '30 minutes',
  },
  'conversion.paths.partial': {
    fix: 'Add whichever conversion path (form, phone, or email) is currently missing so all three are available.',
    priority: 'high',
    difficulty: 'moderate',
    timeEstimate: '1 hour',
  },
  'conversion.paths.single': {
    fix: 'Offer at least two more ways to convert beyond the current single option: form, phone number, and email.',
    priority: 'high',
    difficulty: 'moderate',
    timeEstimate: '1-2 hours',
  },
  'conversion.paths.none': {
    fix: 'Add at minimum a contact form, a clickable phone number, and a clickable email address so visitors have a way to convert.',
    priority: 'critical',
    difficulty: 'moderate',
    timeEstimate: '1-2 hours',
  },
  'conversion.socialproof.notcolocated': {
    fix: 'Move existing testimonials/review scores/trust badges so they appear directly next to CTAs, not just elsewhere on the page.',
    priority: 'high',
    difficulty: 'moderate',
    timeEstimate: '1 hour',
  },
  'conversion.socialproof.missing': {
    fix: 'Place testimonials, review scores, or trust badges near the CTAs. "Join 500+ satisfied customers" next to a contact form measurably increases conversion.',
    priority: 'high',
    difficulty: 'moderate',
    timeEstimate: '1-2 hours',
  },
  'conversion.h1.tooshort': {
    fix: 'Expand the homepage H1 to 8-15 words that communicate what the business does, who it\'s for, and why it\'s different.',
    priority: 'medium',
    difficulty: 'easy',
    timeEstimate: '30 minutes',
  },
  'conversion.h1.missing': {
    fix: 'Write a clear, specific H1 headline on the homepage that communicates what the business does, who it\'s for, and why it\'s different. Aim for 8-15 words.',
    priority: 'critical',
    difficulty: 'easy',
    timeEstimate: '30 minutes',
  },
  'conversion.abovefold.partial': {
    fix: 'Add whichever above-the-fold element is currently missing (H1 headline, supporting text, or CTA button) so all three are present.',
    priority: 'high',
    difficulty: 'easy',
    timeEstimate: '1 hour',
  },
  'conversion.abovefold.missing': {
    fix: 'Ensure the homepage has three elements above the fold: a clear H1 headline, supporting text (1-2 sentences), and a prominent CTA button.',
    priority: 'critical',
    difficulty: 'easy',
    timeEstimate: '1 hour',
  },
  'conversion.leadmagnet.missing': {
    fix: 'Create a lead magnet (free guide, checklist, or consultation) to capture emails from visitors who aren\'t ready to buy yet.',
    priority: 'medium',
    difficulty: 'moderate',
    timeEstimate: '2-4 hours',
  },
  'conversion.pricing.missing': {
    fix: 'Add a clear path to pricing: either a pricing page, a "Get a Quote" form, or a "See Pricing" CTA. Hidden pricing creates friction.',
    priority: 'high',
    difficulty: 'easy',
    timeEstimate: '1 hour',
  },
  'conversion.depth.limited': {
    fix: 'Add more pages (service detail pages, case studies, FAQ) to give different visitor types more paths toward becoming a lead.',
    priority: 'medium',
    difficulty: 'moderate',
    timeEstimate: 'ongoing',
  },
};

/**
 * Look up the internal, technical fix for a finding code.
 *
 * Throws if the code has no entry — coverage gaps must be caught by the
 * fix-coverage test, not silently papered over by a runtime fallback.
 */
export function fixFor(code: string): FixCatalogEntry {
  const entry = (FIX_CATALOG as Record<string, FixCatalogEntry>)[code];
  if (!entry) {
    throw new Error(`No fix-plan entry for code "${code}". Add one to src/lib/audit/fix-plan.ts.`);
  }
  return entry;
}

function priorityRank(priority: 'critical' | 'high' | 'medium' | 'low'): number {
  switch (priority) {
    case 'critical': return 4;
    case 'high': return 3;
    case 'medium': return 2;
    case 'low': return 1;
  }
}

function formatCategoryName(category: CategoryResult): string {
  return category.category_name;
}

function buildFixItem(finding: Finding, category: CategoryResult): FixItem {
  const catalogEntry = fixFor(finding.code);

  return {
    finding: finding.label,
    fix: catalogEntry.fix,
    priority: catalogEntry.priority,
    impact: `Could recover ~${finding.pointsLost} points in ${formatCategoryName(category)}`,
    difficulty: catalogEntry.difficulty,
    timeEstimate: catalogEntry.timeEstimate,
  };
}

function buildCategoryFixPlan(category: CategoryResult): CategoryFixPlan {
  const fixes = category.findings.map((finding) => buildFixItem(finding, category));

  return {
    category_id: category.category_id,
    category_name: category.category_name,
    currentScore: category.score,
    // Projection model: once every finding in this category is fixed, the
    // category earns full marks. We don't try to re-derive this from
    // pointsLost (some deductions are silent bonuses with no finding).
    targetScore: 100,
    fixes,
  };
}

/**
 * Compute the projected overall score once every fix is applied.
 *
 * Every category's targetScore is 100 by construction (see
 * buildCategoryFixPlan), so the weighted average across all categories is
 * always 100 — "fix everything -> perfect score" holds regardless of the
 * specific weights, as long as the weights sum to 100.
 */
function calculateProjectedOverall(categoryPlans: CategoryFixPlan[]): number {
  if (categoryPlans.length === 0) return 100;

  let weightedSum = 0;
  let totalWeight = 0;

  for (const plan of categoryPlans) {
    const weight = CATEGORY_WEIGHTS[plan.category_id] ?? (100 / categoryPlans.length);
    weightedSum += plan.targetScore * weight;
    totalWeight += weight;
  }

  if (totalWeight === 0) return 100;
  return Math.round(weightedSum / totalWeight);
}

function extractQuickWins(categoryPlans: CategoryFixPlan[]): FixItem[] {
  const candidates: FixItem[] = [];

  for (const plan of categoryPlans) {
    for (const fix of plan.fixes) {
      if (fix.difficulty === 'easy' && (fix.priority === 'critical' || fix.priority === 'high')) {
        candidates.push(fix);
      }
    }
  }

  // Sort by priority (critical first), then by impact string (higher point numbers first)
  candidates.sort((a, b) => {
    const priorityDiff = priorityRank(b.priority) - priorityRank(a.priority);
    if (priorityDiff !== 0) return priorityDiff;

    // Extract point numbers from impact strings for secondary sort
    const aPoints = parseFloat(a.impact.match(/~([\d.]+)/)?.[1] || '0');
    const bPoints = parseFloat(b.impact.match(/~([\d.]+)/)?.[1] || '0');
    return bPoints - aPoints;
  });

  return candidates.slice(0, 5);
}

export function buildFixPlan(result: AuditResult): FixPlan {
  const categoryPlans = result.categories.map(buildCategoryFixPlan);
  const projectedScore = calculateProjectedOverall(categoryPlans);
  const quickWins = extractQuickWins(categoryPlans);

  return {
    url: result.url,
    siteName: result.siteName,
    auditDate: result.auditDate,
    currentScore: result.overall_score,
    projectedScore,
    quickWins,
    categories: categoryPlans,
  };
}

// Backwards-compatible alias — `runner.ts` and other consumers import this
// name. Kept as a thin alias rather than duplicated logic.
export const generateFixPlan = buildFixPlan;
