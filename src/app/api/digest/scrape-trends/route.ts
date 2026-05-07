import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { loadNicheKeywords } from "@/lib/digest/keywords";
import { fetchYouTubeTrending } from "@/lib/digest/providers/youtube-trending";
import { fetchTikTokTrending } from "@/lib/digest/providers/tiktok-trending";
import { fetchInstagramTrending } from "@/lib/digest/providers/instagram-trending";
import type { TrendCandidate } from "@/lib/digest/providers/types";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// "Viral" threshold per platform — view count required in the last 48h to count as trending.
// Tuned from short-form benchmarks: TikTok grows fastest, IG slowest.
const MIN_VIEWS: Record<TrendCandidate["source"], number> = {
  tiktok: 100_000,
  youtube: 50_000,
  instagram: 50_000,
};

const TOP_N = 10;
export const maxDuration = 60;

export async function POST(_request: NextRequest) {
  const supabase = getSupabaseAdmin();
  const { data: users } = await supabase.auth.admin.listUsers();
  const userId = users?.users?.[0]?.id;
  if (!userId) {
    return NextResponse.json({ error: "No user found" }, { status: 401 });
  }

  const keywords = loadNicheKeywords();

  const [youtube, tiktok, instagram] = await Promise.all([
    fetchYouTubeTrending(keywords),
    fetchTikTokTrending(keywords),
    fetchInstagramTrending(keywords),
  ]);

  const allCandidates: TrendCandidate[] = [
    ...youtube.candidates,
    ...tiktok.candidates,
    ...instagram.candidates,
  ];

  const allErrors = [...youtube.errors, ...tiktok.errors, ...instagram.errors];

  // Apply viral threshold AND English-language filter.
  const beforeFilter = allCandidates.length;
  const viral = allCandidates.filter((c) => {
    if (c.views == null) return false;
    if (c.views < MIN_VIEWS[c.source]) return false;
    if (!isLikelyEnglish(c.title)) return false;
    return true;
  });

  // Dedupe by URL (some providers might return same URL via different keywords)
  const seen = new Set<string>();
  const uniqueViral = viral.filter((c) => (seen.has(c.url) ? false : (seen.add(c.url), true)));

  // Sort by views DESC, take top N
  uniqueViral.sort((a, b) => (b.views || 0) - (a.views || 0));
  const top = uniqueViral.slice(0, TOP_N);

  if (top.length === 0) {
    const platformBreakdown = countByPlatform(allCandidates);
    return NextResponse.json({
      success: true,
      saved: 0,
      total_candidates: beforeFilter,
      passed_threshold: 0,
      candidates_by_platform_pre_filter: platformBreakdown,
      errors: allErrors.slice(0, 5),
      message:
        beforeFilter > 0
          ? `${beforeFilter} candidates fetched (YT ${platformBreakdown.youtube || 0}, TT ${platformBreakdown.tiktok || 0}, IG ${platformBreakdown.instagram || 0}) but none passed both thresholds (viral + English). ${allErrors.length > 0 ? `${allErrors.length} provider errors — first: "${allErrors[0]}"` : "Niche may be quiet right now."}`
          : `No candidates from any provider.${allErrors.length > 0 ? ` First error: "${allErrors[0]}"` : " Check API keys and host config."}`,
    });
  }

  // Dedupe against existing content_digests (already-saved URLs)
  const candidateUrls = top.map((c) => c.url);
  const { data: existing } = await supabase
    .from("content_digests")
    .select("url")
    .in("url", candidateUrls);
  const existingUrls = new Set((existing || []).map((r) => r.url));

  const fresh = top.filter((c) => !existingUrls.has(c.url));

  if (fresh.length === 0) {
    return NextResponse.json({
      success: true,
      saved: 0,
      total_candidates: beforeFilter,
      passed_threshold: top.length,
      errors: allErrors,
      message: `Top ${top.length} viral picks were already in your library — nothing new to save.`,
    });
  }

  const rows = fresh.map((c) => ({
    user_id: userId,
    url: c.url,
    source: c.source,
    kind: "inspiration" as const,
    status: "completed" as const,
    source_pull: "trend_scrape" as const,
    title: c.title,
    thumbnail_url: c.thumbnail_url,
    tags: [
      ...(c.creator_handle ? [`creator:${c.creator_handle}`] : []),
      ...(c.views ? [`views:${formatViews(c.views)}`] : []),
    ],
    processed_at: new Date().toISOString(),
  }));

  const { data: inserted, error: insertErr } = await supabase
    .from("content_digests")
    .insert(rows)
    .select("id");

  if (insertErr) {
    return NextResponse.json(
      { error: `Insert failed: ${insertErr.message}`, errors: allErrors },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    saved: inserted?.length || 0,
    total_candidates: beforeFilter,
    passed_threshold: top.length,
    by_platform: countByPlatform(fresh),
    errors: allErrors,
  });
}

function countByPlatform(candidates: TrendCandidate[]) {
  return candidates.reduce(
    (acc, c) => ({ ...acc, [c.source]: (acc[c.source] || 0) + 1 }),
    {} as Record<string, number>
  );
}

function formatViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return String(n);
}

// Heuristic English filter — drops content with non-Latin scripts (Hangul, Hiragana,
// Katakana, CJK, Cyrillic, Hebrew, Arabic, Thai, Devanagari) and content that has no
// recognizable English stopwords.
function isLikelyEnglish(text: string | null): boolean {
  if (!text) return true; // can't tell, allow it through and rely on other signals
  if (/[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf\uac00-\ud7af\u0400-\u04ff\u0590-\u05ff\u0600-\u06ff\u0e00-\u0e7f\u0900-\u097f]/.test(text)) {
    return false;
  }
  const lower = text.toLowerCase();
  const englishMarkers = /\b(the|a|an|and|or|but|to|of|in|for|with|on|at|from|by|is|are|was|were|be|been|have|has|had|do|does|did|will|would|could|should|may|might|can|i|you|he|she|it|we|they|this|that|these|those|what|why|how|when|where|who|which|my|your|our|their|me|us|him|her|im|youre|its|dont|cant|wont|ai|like|just|now|new|claude|cursor|coding|code|dev)\b/;
  if (englishMarkers.test(lower)) return true;
  if (text.length < 25) return true; // very short titles get benefit of the doubt
  return false;
}
