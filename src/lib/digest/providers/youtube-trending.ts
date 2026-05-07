// YouTube Data API v3 — keyword search filtered to short videos posted in last 48h.
// Free quota: 10,000 units/day. search.list = 100 units, videos.list = 1 unit.

import type { ProviderResult, TrendCandidate } from "./types";

const SEARCH_URL = "https://www.googleapis.com/youtube/v3/search";
const VIDEOS_URL = "https://www.googleapis.com/youtube/v3/videos";
const HOURS_LOOKBACK = 48;
const PER_KEYWORD_LIMIT = 5;

export async function fetchYouTubeTrending(keywords: string[]): Promise<ProviderResult> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return { source: "youtube", candidates: [], errors: ["YOUTUBE_API_KEY not configured"] };
  }

  const publishedAfter = new Date(Date.now() - HOURS_LOOKBACK * 60 * 60 * 1000).toISOString();
  const errors: string[] = [];
  const idsByKeyword: { keyword: string; ids: string[] }[] = [];

  for (const keyword of keywords) {
    const params = new URLSearchParams({
      part: "snippet",
      q: keyword,
      type: "video",
      videoDuration: "short",
      order: "viewCount",
      publishedAfter,
      maxResults: String(PER_KEYWORD_LIMIT),
      key: apiKey,
    });
    try {
      const res = await fetch(`${SEARCH_URL}?${params.toString()}`);
      if (!res.ok) {
        errors.push(`YT search "${keyword}" → ${res.status}`);
        continue;
      }
      const data = await res.json();
      const ids = (data.items || []).map((it: { id: { videoId: string } }) => it.id.videoId).filter(Boolean);
      idsByKeyword.push({ keyword, ids });
    } catch (err) {
      errors.push(`YT search "${keyword}" → ${err instanceof Error ? err.message : "unknown"}`);
    }
  }

  const allIds = Array.from(new Set(idsByKeyword.flatMap((k) => k.ids)));
  if (allIds.length === 0) {
    return { source: "youtube", candidates: [], errors };
  }

  const candidates: TrendCandidate[] = [];
  for (let i = 0; i < allIds.length; i += 50) {
    const batch = allIds.slice(i, i + 50);
    const params = new URLSearchParams({
      part: "snippet,statistics,contentDetails",
      id: batch.join(","),
      key: apiKey,
    });
    try {
      const res = await fetch(`${VIDEOS_URL}?${params.toString()}`);
      if (!res.ok) {
        errors.push(`YT videos.list → ${res.status}`);
        continue;
      }
      const data = await res.json();
      for (const item of data.items || []) {
        const isShort = (item.contentDetails?.duration || "").match(/PT(\d+)S/)?.[1];
        const seconds = isShort ? parseInt(isShort) : null;
        const isShortFormat = !seconds || seconds <= 180;
        candidates.push({
          url: isShortFormat
            ? `https://www.youtube.com/shorts/${item.id}`
            : `https://www.youtube.com/watch?v=${item.id}`,
          source: "youtube",
          title: item.snippet?.title || null,
          thumbnail_url: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.default?.url || null,
          views: parseInt(item.statistics?.viewCount || "0") || null,
          posted_at: item.snippet?.publishedAt || null,
          creator_handle: item.snippet?.channelTitle || null,
        });
      }
    } catch (err) {
      errors.push(`YT videos.list → ${err instanceof Error ? err.message : "unknown"}`);
    }
  }

  candidates.sort((a, b) => (b.views || 0) - (a.views || 0));
  return { source: "youtube", candidates, errors };
}
