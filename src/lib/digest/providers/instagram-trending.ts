// Instagram trending via RapidAPI (Instagram Scraper Stable API or similar).
// Searches by hashtag — keywords are converted to hashtag-safe form (lowercase, no spaces/quotes).

import type { ProviderResult, TrendCandidate } from "./types";

const PER_KEYWORD_LIMIT = 5;
const HOURS_LOOKBACK = 48;

type InstagramMedia = {
  shortcode?: string;
  caption?: string;
  display_url?: string;
  thumbnail_url?: string;
  like_count?: number;
  play_count?: number;
  taken_at_timestamp?: number;
  owner?: { username?: string };
  user?: { username?: string };
};

function toHashtag(keyword: string): string {
  return keyword.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export async function fetchInstagramTrending(keywords: string[]): Promise<ProviderResult> {
  const rapidApiKey = process.env.RAPIDAPI_KEY;
  const host = process.env.INSTAGRAM_TRENDING_RAPIDAPI_HOST;

  if (!rapidApiKey || !host) {
    return {
      source: "instagram",
      candidates: [],
      errors: [!rapidApiKey ? "RAPIDAPI_KEY missing" : "INSTAGRAM_TRENDING_RAPIDAPI_HOST missing — skipping IG"],
    };
  }

  const cutoff = Math.floor(Date.now() / 1000) - HOURS_LOOKBACK * 3600;
  const errors: string[] = [];
  const candidates: TrendCandidate[] = [];

  for (const keyword of keywords) {
    const tag = toHashtag(keyword);
    if (!tag) continue;

    try {
      // Common endpoint shape — adjust path if your subscribed scraper differs.
      const url = `https://${host}/v1/hashtag?name=${encodeURIComponent(tag)}`;
      const res = await fetch(url, {
        headers: {
          "x-rapidapi-key": rapidApiKey,
          "x-rapidapi-host": host,
        },
      });
      if (!res.ok) {
        errors.push(`IG "${tag}" → ${res.status}`);
        continue;
      }
      const data = await res.json();
      const items: InstagramMedia[] = data.data?.items || data.items || data.media || [];

      let added = 0;
      for (const m of items) {
        if (added >= PER_KEYWORD_LIMIT) break;
        const code = m.shortcode;
        if (!code) continue;
        if (m.taken_at_timestamp && m.taken_at_timestamp < cutoff) continue;

        const handle = m.owner?.username || m.user?.username;
        candidates.push({
          url: `https://www.instagram.com/reel/${code}/`,
          source: "instagram",
          title: m.caption?.slice(0, 100) || null,
          thumbnail_url: m.display_url || m.thumbnail_url || null,
          views: m.play_count || m.like_count || null,
          posted_at: m.taken_at_timestamp ? new Date(m.taken_at_timestamp * 1000).toISOString() : null,
          creator_handle: handle ? `@${handle}` : null,
        });
        added++;
      }
    } catch (err) {
      errors.push(`IG "${tag}" → ${err instanceof Error ? err.message : "unknown"}`);
    }
  }

  const seen = new Set<string>();
  const deduped = candidates.filter((c) => (seen.has(c.url) ? false : (seen.add(c.url), true)));
  deduped.sort((a, b) => (b.views || 0) - (a.views || 0));

  return { source: "instagram", candidates: deduped, errors };
}
