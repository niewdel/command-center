// TikTok trending via RapidAPI (default: ScrapTik).
// Endpoint shape varies by provider — defaults to ScrapTik's /search/general/full.
// Override paths via env if subscribed to a different scraper.

import type { ProviderResult, TrendCandidate } from "./types";

const PER_KEYWORD_LIMIT = 5;
const HOURS_LOOKBACK = 48;

type ScrapTikVideo = {
  aweme_id?: string;
  share_url?: string;
  desc?: string;
  create_time?: number;
  statistics?: { play_count?: number; digg_count?: number };
  author?: { unique_id?: string; nickname?: string };
  video?: { cover?: { url_list?: string[] } };
};

export async function fetchTikTokTrending(keywords: string[]): Promise<ProviderResult> {
  const rapidApiKey = process.env.RAPIDAPI_KEY;
  const host = process.env.TIKTOK_RAPIDAPI_HOST;

  if (!rapidApiKey || !host) {
    return {
      source: "tiktok",
      candidates: [],
      errors: [!rapidApiKey ? "RAPIDAPI_KEY missing" : "TIKTOK_RAPIDAPI_HOST missing"],
    };
  }

  const cutoff = Math.floor(Date.now() / 1000) - HOURS_LOOKBACK * 3600;
  const errors: string[] = [];
  const candidates: TrendCandidate[] = [];

  for (const keyword of keywords) {
    try {
      // ScrapTik: /search/general/full?keyword=<kw>&count=<n>
      // Adjust the path/params if your subscribed scraper uses a different shape.
      const url = `https://${host}/search/general/full?keyword=${encodeURIComponent(keyword)}&count=${PER_KEYWORD_LIMIT}`;
      const res = await fetch(url, {
        headers: {
          "x-rapidapi-key": rapidApiKey,
          "x-rapidapi-host": host,
        },
      });
      if (!res.ok) {
        errors.push(`TT "${keyword}" → ${res.status}`);
        continue;
      }
      const data = await res.json();
      const videos: ScrapTikVideo[] = data.data || data.videos || data.aweme_list || [];

      for (const v of videos) {
        const id = v.aweme_id;
        if (!id) continue;
        if (v.create_time && v.create_time < cutoff) continue;

        const handle = v.author?.unique_id || v.author?.nickname;
        const url = v.share_url || (handle ? `https://www.tiktok.com/@${handle}/video/${id}` : `https://www.tiktok.com/video/${id}`);

        candidates.push({
          url,
          source: "tiktok",
          title: v.desc || null,
          thumbnail_url: v.video?.cover?.url_list?.[0] || null,
          views: v.statistics?.play_count || null,
          posted_at: v.create_time ? new Date(v.create_time * 1000).toISOString() : null,
          creator_handle: handle ? `@${handle}` : null,
        });
      }
    } catch (err) {
      errors.push(`TT "${keyword}" → ${err instanceof Error ? err.message : "unknown"}`);
    }
  }

  // Dedupe by URL
  const seen = new Set<string>();
  const deduped = candidates.filter((c) => (seen.has(c.url) ? false : (seen.add(c.url), true)));
  deduped.sort((a, b) => (b.views || 0) - (a.views || 0));

  return { source: "tiktok", candidates: deduped, errors };
}
