import type { CrawledPage } from "./types";
import { normalizeUrl, hasSkippableExtension } from "./url-utils";

const DEFAULT_CAP = 15;

/** Landmarks that count as "primary nav" for main-pages discovery. */
const NAV_LOCATIONS = new Set(["header", "nav", "footer"]);

/** Rank tiers — lower is more prominent (header/nav beats footer). */
function prominence(location: CrawledPage["links"][number]["location"]): number {
  return location === "footer" ? 1 : 0;
}

function isSkippableProtocol(href: string): boolean {
  return /^(mailto|tel|javascript):/i.test(href.trim()) || href.trim().startsWith("#");
}

/**
 * Derive a site's "main pages" from its homepage's header/nav/footer links —
 * the pages a real visitor would reach via primary navigation. Pure function:
 * takes an already-crawled homepage, returns a ranked, deduped, capped list
 * of page URLs (always including the homepage itself).
 *
 * Callers (e.g. `crawlSite`'s "main" mode) should top up from sitemap/BFS
 * discovery when this returns too few pages (nav-poor sites).
 */
export function discoverMainPages(home: CrawledPage, cap: number = DEFAULT_CAP): string[] {
  const homeUrl = normalizeUrl(home.url) ?? home.url;

  type Candidate = { url: string; rank: number; order: number };
  const candidates: Candidate[] = [];
  const seenPaths = new Set<string>();

  // Homepage's own path is always considered "seen" so nav links back to "/"
  // don't get re-added as a duplicate entry.
  seenPaths.add(pathKey(homeUrl));

  home.links.forEach((link, order) => {
    if (!link.isInternal) return;
    if (!link.location || !NAV_LOCATIONS.has(link.location)) return;
    if (isSkippableProtocol(link.href)) return;
    if (hasSkippableExtension(link.href)) return;

    const normalized = normalizeUrl(link.href, home.url);
    if (!normalized) return;

    const key = pathKey(normalized);
    if (seenPaths.has(key)) return;
    seenPaths.add(key);

    candidates.push({ url: normalized, rank: prominence(link.location), order });
  });

  candidates.sort((a, b) => a.rank - b.rank || a.order - b.order);

  const topped = candidates.slice(0, Math.max(cap - 1, 0)).map((c) => c.url);

  return [homeUrl, ...topped];
}

function pathKey(url: string): string {
  try {
    const u = new URL(url);
    return `${u.pathname.replace(/\/+$/, "") || "/"}`;
  } catch {
    return url;
  }
}
