// Freshness scoring — derives a single "median days since last change" number
// across the crawled page set. Two signals, in order of preference:
//
//   1. Sitemap <lastmod> — most authoritative when present.
//   2. content_hash diff vs prior seo_check — if hash unchanged since prior
//      check, the page hasn't been touched since at least that check date.
//
// Pages with neither signal are excluded from the median. If no page has any
// signal at all, the score is null.

import { getServiceClient } from "./db";
import type { PageSnapshot } from "./types";

// Normalize the URL the same way the crawler/dedup does so we can match
// sitemap entries against PageSnapshot.url cleanly.
function normalize(raw: string): string {
  try {
    const u = new URL(raw);
    u.hash = "";
    u.search = "";
    u.pathname = u.pathname.replace(/\/+$/, "") || "/";
    return u.toString();
  } catch {
    return raw;
  }
}

// Pull sitemap.xml (and any nested sitemap-index entries) and extract
// <loc>+<lastmod> pairs. Returns a Map keyed by normalized URL.
export async function fetchSitemapLastmods(
  rootUrl: string
): Promise<Map<string, Date>> {
  const out = new Map<string, Date>();
  const seen = new Set<string>();
  const rootOrigin = (() => {
    try {
      return new URL(rootUrl).origin;
    } catch {
      return null;
    }
  })();
  if (!rootOrigin) return out;

  async function parse(sitemapUrl: string): Promise<void> {
    if (seen.has(sitemapUrl)) return;
    seen.add(sitemapUrl);
    try {
      const res = await fetch(sitemapUrl, {
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) return;
      const xml = await res.text();

      // Sitemap index: recurse into nested sitemaps.
      const indexMatches = [
        ...xml.matchAll(
          /<sitemap[^>]*>[\s\S]*?<loc>\s*(.*?)\s*<\/loc>[\s\S]*?<\/sitemap>/gi
        ),
      ];
      for (const m of indexMatches) {
        await parse(m[1]);
      }

      // URL entries with optional lastmod.
      const urlMatches = [
        ...xml.matchAll(/<url[^>]*>([\s\S]*?)<\/url>/gi),
      ];
      for (const m of urlMatches) {
        const block = m[1];
        const loc = block.match(/<loc>\s*(.*?)\s*<\/loc>/i)?.[1];
        if (!loc) continue;
        const lastmodRaw = block.match(/<lastmod>\s*(.*?)\s*<\/lastmod>/i)?.[1];
        const lastmod = lastmodRaw ? new Date(lastmodRaw) : null;
        const valid = lastmod && !isNaN(lastmod.getTime()) ? lastmod : null;
        out.set(normalize(loc), valid as Date);
      }
    } catch {
      // sitemap unreachable / malformed — ignore
    }
  }

  await parse(`${rootOrigin}/sitemap.xml`);
  return out;
}

// Compute freshness_days as the median across pages of "days since last known
// change." Returns null if no page has any freshness signal.
export async function computeFreshnessDays(opts: {
  client_id: string;
  rootUrl: string;
  snapshots: PageSnapshot[];
}): Promise<number | null> {
  const { client_id, rootUrl, snapshots } = opts;
  if (snapshots.length === 0) return null;

  const lastmods = await fetchSitemapLastmods(rootUrl);
  const now = Date.now();

  // Look up the most recent prior seo_check so we can match content_hashes
  // for pages without sitemap lastmod data. We only need created_at + pages.
  const sb = getServiceClient();
  const { data: prior } = await sb
    .from("seo_checks")
    .select("created_at, pages")
    .eq("client_id", client_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const priorByUrl = new Map<string, { content_hash: string; created_at: string }>();
  if (prior?.pages && Array.isArray(prior.pages)) {
    for (const p of prior.pages as PageSnapshot[]) {
      priorByUrl.set(normalize(p.url), {
        content_hash: p.content_hash,
        created_at: prior.created_at,
      });
    }
  }

  const ages: number[] = [];
  for (const snap of snapshots) {
    const key = normalize(snap.url);
    const lm = lastmods.get(key);
    if (lm instanceof Date) {
      const days = Math.max(
        0,
        Math.round((now - lm.getTime()) / 86_400_000)
      );
      ages.push(days);
      continue;
    }
    const priorMatch = priorByUrl.get(key);
    if (priorMatch && priorMatch.content_hash === snap.content_hash) {
      // Hash unchanged since prior check — content is at least that old.
      const days = Math.max(
        0,
        Math.round(
          (now - new Date(priorMatch.created_at).getTime()) / 86_400_000
        )
      );
      ages.push(days);
    }
    // Else: brand new URL, or hash changed this run → no signal, skip.
  }

  if (ages.length === 0) return null;

  ages.sort((a, b) => a - b);
  const mid = Math.floor(ages.length / 2);
  return ages.length % 2 === 0
    ? Math.round((ages[mid - 1] + ages[mid]) / 2)
    : ages[mid];
}
