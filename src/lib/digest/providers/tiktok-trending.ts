// TikTok trending via RapidAPI ScrapTik.
// ScrapTik wraps each video in an `aweme_info` object inside `data` array.

import type { ProviderResult, TrendCandidate } from "./types";

const PER_KEYWORD_LIMIT = 10;
const HOURS_LOOKBACK = 48;

type ScrapTikVideo = {
  aweme_id?: string;
  share_url?: string;
  desc?: string;
  create_time?: number;
  statistics?: { play_count?: number; digg_count?: number };
  author?: { unique_id?: string; nickname?: string };
  video?: { cover?: { url_list?: string[] }; origin_cover?: { url_list?: string[] } };
};

type ScrapTikSearchItem = {
  type?: number;
  aweme_info?: ScrapTikVideo;
} & ScrapTikVideo;

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
      // ScrapTik /search/general/full returns wrapped items: data: [{ type, aweme_info: {...} }, ...]
      const url = `https://${host}/search/general/full?keyword=${encodeURIComponent(keyword)}&count=${PER_KEYWORD_LIMIT}&region=US`;
      const res = await fetch(url, {
        headers: {
          "x-rapidapi-key": rapidApiKey,
          "x-rapidapi-host": host,
        },
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        errors.push(`TT "${keyword}" → ${res.status}${body ? `: ${body.slice(0, 80)}` : ""}`);
        continue;
      }
      const data = await res.json();

      // Response shape varies between ScrapTik plans; try several known wrappers.
      const rawItems: ScrapTikSearchItem[] =
        data?.data ||
        data?.aweme_list ||
        data?.videos ||
        data?.data?.aweme_list ||
        [];

      if (rawItems.length === 0 && data?.message) {
        errors.push(`TT "${keyword}" → API said: ${String(data.message).slice(0, 100)}`);
        continue;
      }

      let kept = 0;
      for (const item of rawItems) {
        // Unwrap if response uses { type, aweme_info } shape
        const v: ScrapTikVideo = item.aweme_info || item;
        const id = v.aweme_id;
        if (!id) continue;
        if (v.create_time && v.create_time < cutoff) continue;

        const handle = v.author?.unique_id || v.author?.nickname;
        const shareUrl = v.share_url || (handle ? `https://www.tiktok.com/@${handle}/video/${id}` : `https://www.tiktok.com/video/${id}`);
        const thumbnail = v.video?.cover?.url_list?.[0] || v.video?.origin_cover?.url_list?.[0] || null;

        candidates.push({
          url: shareUrl,
          source: "tiktok",
          title: v.desc || null,
          thumbnail_url: thumbnail,
          views: v.statistics?.play_count || null,
          posted_at: v.create_time ? new Date(v.create_time * 1000).toISOString() : null,
          creator_handle: handle ? `@${handle}` : null,
        });
        kept++;
      }

      if (kept === 0 && rawItems.length > 0) {
        errors.push(`TT "${keyword}" → ${rawItems.length} items returned but none parsed (response shape may have changed)`);
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
