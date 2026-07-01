import { chromium, type Browser, type Page, type Response } from 'playwright';
import { CrawledPage } from './types';
import { parseRobots, checkUrlExists } from '../seo/site-checks';
import { normalizeUrl, isSameDomain, hasSkippableExtension } from './url-utils';
import { discoverMainPages } from './discover-main-pages';

const DEFAULT_MAX_PAGES = 50;
const MAIN_MODE_CAP = 15;
const PAGE_TIMEOUT = 15_000;

export interface CrawlOptions {
  /** Cap the number of pages crawled. Pass 1 for single-page audits. */
  maxPages?: number;
  /** Skip robots.txt + sitemap discovery. Useful for fast single-URL audits. */
  skipDiscovery?: boolean;
  /**
   * "main" — crawl the homepage first, seed the queue from its primary nav
   * (header/nav/footer links, via `discoverMainPages`), and top up from the
   * existing sitemap/BFS discovery if nav yields too few pages.
   */
  mode?: "main";
}

export { normalizeUrl, hasSkippableExtension };

// ---------------------------------------------------------------------------
// robots.txt
// ---------------------------------------------------------------------------

interface RobotsRules {
  disallowed: string[];
}

async function fetchRobotsTxt(rootOrigin: string): Promise<RobotsRules> {
  const rules: RobotsRules = { disallowed: [] };
  try {
    const res = await fetch(`${rootOrigin}/robots.txt`);
    if (!res.ok) return rules;
    const text = await res.text();

    // Parse robots.txt into groups per user-agent, only collect rules for "*"
    let currentAgents: string[] = [];
    let collectingAgents = true;

    for (const rawLine of text.split('\n')) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;

      if (line.toLowerCase().startsWith('user-agent:')) {
        const agent = line.slice('user-agent:'.length).trim();
        if (!collectingAgents) {
          // New group — reset
          currentAgents = [];
          collectingAgents = true;
        }
        currentAgents.push(agent);
      } else {
        collectingAgents = false;
        const isWildcardGroup = currentAgents.some(a => a === '*');
        if (isWildcardGroup && line.toLowerCase().startsWith('disallow:')) {
          const path = line.slice('disallow:'.length).trim();
          if (path) rules.disallowed.push(path);
        }
      }
    }
  } catch {
    // robots.txt fetch failed — allow everything
  }
  return rules;
}

function isDisallowed(urlStr: string, rules: RobotsRules): boolean {
  try {
    const pathname = new URL(urlStr).pathname;
    return rules.disallowed.some((rule) => pathname.startsWith(rule));
  } catch {
    return false;
  }
}

/**
 * AEO-specific robots + llms.txt signals for a site, used by the AEO scoring
 * adapter (`scoring/aeo.ts`). Kept separate from `fetchRobotsTxt`/`isDisallowed`
 * above (which only care about the "*" crawl-disallow group for BFS discovery).
 *
 * Reuses the AI-bot-aware robots.txt parser from `src/lib/seo/site-checks.ts`
 * rather than re-implementing user-agent-group parsing a second time.
 */
export interface AeoRobotsSignals {
  /** AI crawler user-agent names disallowed for "/" (GPTBot, ClaudeBot, etc). */
  blockedAiBots: string[];
  hasLlmsTxt: boolean;
}

export async function fetchAeoRobotsSignals(rootUrl: string): Promise<AeoRobotsSignals> {
  const rootOrigin = new URL(rootUrl).origin;

  let blockedAiBots: string[] = [];
  try {
    const res = await fetch(`${rootOrigin}/robots.txt`);
    if (res.ok) {
      const text = await res.text();
      blockedAiBots = parseRobots(text).blockedAiBots;
    }
  } catch {
    // robots.txt fetch failed — treat as unblocked
  }

  const hasLlmsTxt = await checkUrlExists(`${rootOrigin}/llms.txt`);

  return { blockedAiBots, hasLlmsTxt };
}

// ---------------------------------------------------------------------------
// Sitemap parsing
// ---------------------------------------------------------------------------

async function discoverFromSitemap(rootOrigin: string): Promise<string[]> {
  const urls: string[] = [];
  const visited = new Set<string>();

  async function parseSitemap(sitemapUrl: string): Promise<void> {
    if (visited.has(sitemapUrl)) return;
    visited.add(sitemapUrl);

    try {
      const res = await fetch(sitemapUrl);
      if (!res.ok) return;
      const xml = await res.text();

      // Sitemap index: contains <sitemap><loc>...</loc></sitemap>
      const sitemapLocs = [...xml.matchAll(/<sitemap[^>]*>[\s\S]*?<loc>\s*(.*?)\s*<\/loc>[\s\S]*?<\/sitemap>/gi)];
      for (const match of sitemapLocs) {
        await parseSitemap(match[1]);
      }

      // URL set: contains <url><loc>...</loc></url>
      const urlLocs = [...xml.matchAll(/<url[^>]*>[\s\S]*?<loc>\s*(.*?)\s*<\/loc>[\s\S]*?<\/url>/gi)];
      for (const match of urlLocs) {
        const normalized = normalizeUrl(match[1]);
        if (normalized && isSameDomain(normalized, rootOrigin)) {
          urls.push(normalized);
        }
      }
    } catch {
      // Sitemap not reachable — ignore
    }
  }

  await parseSitemap(`${rootOrigin}/sitemap.xml`);
  return urls;
}

// ---------------------------------------------------------------------------
// Page extraction
// ---------------------------------------------------------------------------

async function extractPageData(page: Page, response: Response | null, pageUrl: string, rootOrigin: string): Promise<CrawledPage> {
  const statusCode = response?.status() ?? 0;

  const data = await page.evaluate((origin: string) => {
    const title = document.title || '';
    const metaDesc = document.querySelector('meta[name="description"]')?.getAttribute('content') || '';

    // Headings
    const headings: { level: number; text: string }[] = [];
    document.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((el) => {
      const level = parseInt(el.tagName.substring(1), 10);
      const text = (el as HTMLElement).innerText?.trim() || '';
      if (text) headings.push({ level, text });
    });

    // Body text
    const bodyText = document.body?.innerText?.trim() || '';

    // Links
    const links: { href: string; text: string; isInternal: boolean; location: 'header' | 'nav' | 'footer' | 'body' }[] = [];
    const closestSection = (el: Element): 'header' | 'nav' | 'footer' | 'body' => {
      let cur: Element | null = el;
      while (cur) {
        const tag = cur.tagName?.toLowerCase();
        if (tag === 'header' || tag === 'nav' || tag === 'footer') return tag;
        cur = cur.parentElement;
      }
      return 'body';
    };
    document.querySelectorAll('a[href]').forEach((el) => {
      const anchor = el as HTMLAnchorElement;
      const href = anchor.href;
      const text = anchor.innerText?.trim() || anchor.getAttribute('aria-label') || '';
      let isInternal = false;
      try {
        isInternal = new URL(href).origin === origin;
      } catch {
        isInternal = true; // relative URLs are internal
      }
      links.push({ href, text, isInternal, location: closestSection(anchor) });
    });

    // Images
    const images: { src: string; alt: string; srcset?: string }[] = [];
    document.querySelectorAll('img').forEach((el) => {
      const img = el as HTMLImageElement;
      images.push({
        src: img.src || '',
        alt: img.alt || '',
        srcset: img.srcset || undefined,
      });
    });

    // Head <link> elements (favicon, stylesheets, preconnects, etc.)
    const headLinks: { rel: string; href: string }[] = [];
    document.querySelectorAll('head link[rel]').forEach((el) => {
      const rel = el.getAttribute('rel') || '';
      const href = el.getAttribute('href') || '';
      if (rel && href) headLinks.push({ rel, href });
    });

    // Forms
    const forms: { action: string; method: string; fieldCount: number; fields: string[] }[] = [];
    document.querySelectorAll('form').forEach((el) => {
      const form = el as HTMLFormElement;
      const inputs = Array.from(form.querySelectorAll('input, textarea, select'));
      const fields = inputs.map((i) => {
        const inp = i as HTMLInputElement;
        return inp.placeholder || inp.name || inp.type || i.tagName.toLowerCase();
      }).filter(Boolean);
      forms.push({
        action: form.action || '',
        method: form.method || 'get',
        fieldCount: inputs.length,
        fields,
      });
    });

    // Iframes (many forms are embedded: HubSpot, Typeform, Calendly, JotForm, Google Forms, etc.)
    const iframes: { src: string; title: string }[] = [];
    document.querySelectorAll('iframe').forEach((el) => {
      const iframe = el as HTMLIFrameElement;
      if (iframe.src || iframe.title) {
        iframes.push({ src: iframe.src || '', title: iframe.title || '' });
      }
    });

    // Buttons
    const buttons: { text: string; type: string }[] = [];
    document.querySelectorAll('button, [role="button"], input[type="submit"]').forEach((el) => {
      const btn = el as HTMLButtonElement;
      const text = btn.innerText?.trim() || btn.getAttribute('aria-label') || '';
      buttons.push({ text, type: btn.type || '' });
    });

    // OG tags
    const ogTags: Record<string, string> = {};
    document.querySelectorAll('meta[property^="og:"]').forEach((el) => {
      const prop = el.getAttribute('property');
      const content = el.getAttribute('content');
      if (prop && content) ogTags[prop] = content;
    });

    // Structured data (JSON-LD)
    const structuredData: unknown[] = [];
    document.querySelectorAll('script[type="application/ld+json"]').forEach((el) => {
      try {
        structuredData.push(JSON.parse(el.textContent || ''));
      } catch {
        // malformed JSON-LD — skip
      }
    });

    return { title, metaDescription: metaDesc, headings, bodyText, links, headLinks, images, forms, iframes, buttons, ogTags, structuredData };
  }, rootOrigin);

  return {
    url: pageUrl,
    statusCode,
    ...data,
  };
}

// ---------------------------------------------------------------------------
// Link discovery from a crawled page
// ---------------------------------------------------------------------------

function extractInternalLinks(crawledPage: CrawledPage, rootOrigin: string): string[] {
  const found: string[] = [];
  for (const link of crawledPage.links) {
    if (!link.isInternal) continue;
    const normalized = normalizeUrl(link.href, crawledPage.url);
    if (normalized && isSameDomain(normalized, rootOrigin) && !hasSkippableExtension(normalized)) {
      found.push(normalized);
    }
  }
  return found;
}

// ---------------------------------------------------------------------------
// Main crawl function
// ---------------------------------------------------------------------------

export async function crawlSite(
  rootUrl: string,
  onProgress?: (message: string, done: number, total: number) => void,
  options: CrawlOptions = {},
): Promise<CrawledPage[]> {
  const mode = options.mode;
  const maxPages = options.maxPages ?? (mode === "main" ? MAIN_MODE_CAP : DEFAULT_MAX_PAGES);
  const skipDiscovery = options.skipDiscovery ?? maxPages === 1;
  const rootOrigin = new URL(rootUrl).origin;
  const normalizedRoot = normalizeUrl(rootUrl) || rootUrl;

  const progress = (msg: string, done: number, total: number) => {
    if (onProgress) onProgress(msg, done, total);
  };

  let robotsRules: RobotsRules = { disallowed: [] };
  let sitemapUrls: string[] = [];

  if (!skipDiscovery) {
    progress('Checking robots.txt...', 0, 0);
    robotsRules = await fetchRobotsTxt(rootOrigin);

    progress('Discovering pages from sitemap...', 0, 0);
    sitemapUrls = await discoverFromSitemap(rootOrigin);
  }

  // Build initial queue: sitemap URLs + root URL, deduplicated
  const seen = new Set<string>();
  const queue: string[] = [];

  function enqueue(url: string) {
    if (seen.has(url)) return;
    if (isDisallowed(url, robotsRules)) return;
    if (hasSkippableExtension(url)) return;
    seen.add(url);
    queue.push(url);
  }

  // Always start with the root. In "main" mode, hold off on seeding the
  // sitemap URLs — we seed from the homepage's primary nav instead, once
  // it's been crawled (see below), and only fall back to sitemap/BFS to
  // top up if nav is thin.
  enqueue(normalizedRoot);
  if (mode !== "main") {
    for (const u of sitemapUrls) {
      enqueue(u);
    }
  }

  progress(`Found ${queue.length} page(s) to crawl`, 0, Math.min(queue.length, maxPages));

  let browser: Browser | null = null;
  const results: CrawledPage[] = [];

  try {
    browser = await chromium.launch({
      headless: true,
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (compatible; NiewdelSiteAuditBot/1.0)',
      viewport: { width: 1280, height: 800 },
      ignoreHTTPSErrors: true,
    });

    let idx = 0;
    while (idx < queue.length && results.length < maxPages) {
      const pageUrl = queue[idx];
      idx++;

      const total = Math.min(Math.max(queue.length, idx), maxPages);
      progress(`Crawling: ${pageUrl}`, results.length, total);

      let page: Page | null = null;
      try {
        page = await context.newPage();
        const response = await page.goto(pageUrl, {
          waitUntil: 'domcontentloaded',
          timeout: PAGE_TIMEOUT,
        });

        // Wait for JS frameworks to render content (React, Vue, etc.)
        try {
          await page.waitForFunction(
            () => (document.body?.innerText?.length ?? 0) > 100,
            { timeout: 5000 }
          );
        } catch {
          // If body still empty after 5s, proceed with what we have
        }
        // Extra settle time for iframes, lazy-loaded forms, embeds
        await page.waitForTimeout(2000);

        // Verify we got HTML
        const contentType = response?.headers()['content-type'] || '';
        if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
          await page.close();
          continue;
        }

        const crawled = await extractPageData(page, response, pageUrl, rootOrigin);
        results.push(crawled);

        // "main" mode: once the homepage is crawled, seed the queue from its
        // primary nav (header/nav/footer links). If nav is thin (< ~5 pages
        // total, including the homepage), top up with the sitemap URLs we
        // already fetched — BFS link-following below fills in the rest.
        if (mode === "main" && crawled.url === normalizedRoot && results.length === 1) {
          const navUrls = discoverMainPages(crawled, maxPages).filter((u) => u !== normalizedRoot);
          progress(`Found ${navUrls.length} nav page(s) on homepage`, results.length, Math.min(queue.length, maxPages));
          for (const navUrl of navUrls) {
            enqueue(navUrl);
          }
          if (navUrls.length < 4) {
            for (const u of sitemapUrls) {
              enqueue(u);
            }
          }
        }

        // Discover new links from this page for BFS traversal
        const newLinks = extractInternalLinks(crawled, rootOrigin);
        for (const link of newLinks) {
          enqueue(link);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        progress(`Skipping ${pageUrl}: ${message}`, results.length, total);
        // "main" mode couldn't discover nav from a failed homepage load —
        // fall back to sitemap/BFS discovery so the crawl isn't left empty.
        if (mode === "main" && pageUrl === normalizedRoot && results.length === 0) {
          for (const u of sitemapUrls) {
            enqueue(u);
          }
        }
      } finally {
        if (page) {
          try { await page.close(); } catch { /* ignore */ }
        }
      }
    }

    progress(`Crawl complete: ${results.length} page(s)`, results.length, results.length);
  } finally {
    if (browser) {
      try { await browser.close(); } catch { /* ignore */ }
    }
  }

  return results;
}
