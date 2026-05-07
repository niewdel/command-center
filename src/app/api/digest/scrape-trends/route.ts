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

  // Apply viral threshold: drop candidates with no view data or views below platform threshold.
  const beforeFilter = allCandidates.length;
  const viral = allCandidates.filter((c) => {
    if (c.views == null) return false;
    return c.views >= MIN_VIEWS[c.source];
  });

  // Dedupe by URL (some providers might return same URL via different keywords)
  const seen = new Set<string>();
  const uniqueViral = viral.filter((c) => (seen.has(c.url) ? false : (seen.add(c.url), true)));

  // Sort by views DESC, take top N
  uniqueViral.sort((a, b) => (b.views || 0) - (a.views || 0));
  const top = uniqueViral.slice(0, TOP_N);

  if (top.length === 0) {
    return NextResponse.json({
      success: true,
      saved: 0,
      total_candidates: beforeFilter,
      passed_threshold: 0,
      errors: allErrors,
      message:
        beforeFilter > 0
          ? `${beforeFilter} candidates fetched but none hit the viral threshold (TT ≥100k, YT/IG ≥50k views in 48h). Try again later, broaden the keyword list, or your niche may genuinely be quiet right now.`
          : "No candidates returned by any provider. Check API keys and provider host configuration.",
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
