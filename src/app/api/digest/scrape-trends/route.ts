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

  if (allCandidates.length === 0) {
    return NextResponse.json({
      success: true,
      saved: 0,
      total_candidates: 0,
      errors: allErrors,
      message: "No candidates returned. Check API keys + provider hosts.",
    });
  }

  // Dedupe against existing content_digests
  const candidateUrls = allCandidates.map((c) => c.url);
  const { data: existing } = await supabase
    .from("content_digests")
    .select("url")
    .in("url", candidateUrls);
  const existingUrls = new Set((existing || []).map((r) => r.url));

  const fresh = allCandidates.filter((c) => !existingUrls.has(c.url));

  if (fresh.length === 0) {
    return NextResponse.json({
      success: true,
      saved: 0,
      total_candidates: allCandidates.length,
      errors: allErrors,
      message: "All candidates were already saved.",
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
    tags: c.creator_handle ? [`creator:${c.creator_handle}`] : [],
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
    total_candidates: allCandidates.length,
    by_platform: {
      youtube: youtube.candidates.length,
      tiktok: tiktok.candidates.length,
      instagram: instagram.candidates.length,
    },
    errors: allErrors,
  });
}
