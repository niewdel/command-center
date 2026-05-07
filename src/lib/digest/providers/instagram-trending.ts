// Instagram trending via RapidAPI (Instagram Scraper Stable API by restyler).
// Tries multiple known endpoint paths because the API has had several variants.

import type { ProviderResult, TrendCandidate } from "./types";

const PER_KEYWORD_LIMIT = 10;
const HOURS_LOOKBACK = 48;

type InstagramMedia = {
  shortcode?: string;
  code?: string;
  caption?: string | { text?: string };
  display_url?: string;
  thumbnail_url?: string;
  thumbnail_src?: string;
  image_versions2?: { candidates?: { url?: string }[] };
  like_count?: number;
  play_count?: number;
  view_count?: number;
  taken_at_timestamp?: number;
  taken_at?: number;
  owner?: { username?: string };
  user?: { username?: string };
};

function toHashtag(keyword: string): string {
  return keyword.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function extractCaption(caption: InstagramMedia["caption"]): string | null {
  if (!caption) return null;
  if (typeof caption === "string") return caption.slice(0, 100);
  if (typeof caption === "object" && caption.text) return caption.text.slice(0, 100);
  return null;
}

export async function fetchInstagramTrending(keywords: string[]): Promise<ProviderResult> {
  const rapidApiKey = process.env.RAPIDAPI_KEY;
  const host = process.env.INSTAGRAM_TRENDING_RAPIDAPI_HOST;

  if (!rapidApiKey || !host) {
    return {
      source: "instagram",
      candidates: [],
      errors: [!rapidApiKey ? "RAPIDAPI_KEY missing" : "INSTAGRAM_TRENDING_RAPIDAPI_HOST missing"],
    };
  }

  const cutoff = Math.floor(Date.now() / 1000) - HOURS_LOOKBACK * 3600;
  const errors: string[] = [];
  const candidates: TrendCandidate[] = [];

  // Known endpoint patterns for restyler/instagram-scraper-stable-api and variants.
  const endpointTemplates = [
    (tag: string) => `https://${host}/v1/hashtag?ig=${encodeURIComponent(tag)}`,
    (tag: string) => `https://${host}/v1/hashtag?name=${encodeURIComponent(tag)}`,
    (tag: string) => `https://${host}/hashtag?name=${encodeURIComponent(tag)}`,
    (tag: string) => `https://${host}/v1/hashtag/${encodeURIComponent(tag)}`,
  ];

  let workingTemplate: ((tag: string) => string) | null = null;

  for (const keyword of keywords) {
    const tag = toHashtag(keyword);
    if (!tag) continue;

    let data: { data?: { items?: InstagramMedia[] }; items?: InstagramMedia[]; medias?: InstagramMedia[] } | null = null;
    let usedTemplate: ((tag: string) => string) | null = null;

    if (workingTemplate) {
      try {
        const res = await fetch(workingTemplate(tag), {
          headers: { "x-rapidapi-key": rapidApiKey, "x-rapidapi-host": host },
        });
        if (res.ok) {
          data = await res.json();
          usedTemplate = workingTemplate;
        }
      } catch {
        // fall through to template discovery below
      }
    }

    if (!data) {
      for (const tmpl of endpointTemplates) {
        try {
          const res = await fetch(tmpl(tag), {
            headers: { "x-rapidapi-key": rapidApiKey, "x-rapidapi-host": host },
          });
          if (res.ok) {
            data = await res.json();
            usedTemplate = tmpl;
            workingTemplate = tmpl;
            break;
          }
        } catch {
          // try next template
        }
      }
    }

    if (!data) {
      errors.push(`IG "${tag}" → all endpoint templates returned non-OK`);
      continue;
    }

    // Try several response shapes
    const items: InstagramMedia[] =
      data?.data?.items ||
      data?.items ||
      data?.medias ||
      [];

    if (items.length === 0) {
      errors.push(`IG "${tag}" → 0 items in response${usedTemplate ? "" : " (no working template)"}`);
      continue;
    }

    let added = 0;
    for (const m of items) {
      if (added >= PER_KEYWORD_LIMIT) break;
      const code = m.shortcode || m.code;
      if (!code) continue;

      const ts = m.taken_at_timestamp || m.taken_at;
      if (ts && ts < cutoff) continue;

      const handle = m.owner?.username || m.user?.username;
      const thumbnail =
        m.display_url ||
        m.thumbnail_url ||
        m.thumbnail_src ||
        m.image_versions2?.candidates?.[0]?.url ||
        null;

      candidates.push({
        url: `https://www.instagram.com/reel/${code}/`,
        source: "instagram",
        title: extractCaption(m.caption),
        thumbnail_url: thumbnail,
        views: m.play_count || m.view_count || m.like_count || null,
        posted_at: ts ? new Date(ts * 1000).toISOString() : null,
        creator_handle: handle ? `@${handle}` : null,
      });
      added++;
    }
  }

  const seen = new Set<string>();
  const deduped = candidates.filter((c) => (seen.has(c.url) ? false : (seen.add(c.url), true)));
  deduped.sort((a, b) => (b.views || 0) - (a.views || 0));

  return { source: "instagram", candidates: deduped, errors };
}
