import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchRSSFeeds } from "@/lib/news/rss";
import { curateStories } from "@/lib/news/curate";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const headerSecret =
        request.headers.get("x-cron-secret") ||
        request.headers.get("authorization")?.replace("Bearer ", "");
      if (headerSecret?.trim() !== cronSecret.trim()) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
    }

    const supabase = getSupabaseAdmin();

    // Fetch active topics
    const { data: topics } = await supabase
      .from("news_topics")
      .select("*")
      .eq("active", true)
      .order("position");

    if (!topics || topics.length === 0) {
      return NextResponse.json({ message: "No active topics" });
    }

    // Get user context for personalization
    const { data: settings } = await supabase
      .from("user_settings")
      .select("digest_context")
      .limit(1)
      .single();

    // Get existing story URLs to avoid duplicates
    const { data: existingStories } = await supabase
      .from("news_stories")
      .select("url");
    const existingUrls = new Set((existingStories || []).map((s) => s.url));

    let totalAdded = 0;

    for (const topic of topics) {
      const feedUrls: string[] = Array.isArray(topic.rss_feeds) ? topic.rss_feeds : [];
      if (feedUrls.length === 0) continue;

      // Fetch RSS items
      const items = await fetchRSSFeeds(feedUrls);
      if (items.length === 0) continue;

      // Filter out already-known URLs
      const newItems = items.filter((item) => !existingUrls.has(item.url));
      if (newItems.length === 0) continue;

      // Curate with Claude
      const curated = await curateStories(
        newItems,
        topic.name,
        anthropicKey,
        settings?.digest_context
      );

      // Insert stories
      for (const story of curated) {
        const { error } = await supabase.from("news_stories").upsert(
          {
            topic_id: topic.id,
            title: story.title,
            url: story.url,
            source_name: story.source_name,
            summary: story.summary,
            topic: topic.name,
            published_at: story.published_at,
            fetched_at: new Date().toISOString(),
            relevance_score: story.relevance_score,
          },
          { onConflict: "url" }
        );

        if (!error) {
          totalAdded++;
          existingUrls.add(story.url);
        }
      }
    }

    // Cleanup stories older than 7 days
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { count: cleaned } = await supabase
      .from("news_stories")
      .delete()
      .lt("fetched_at", weekAgo);

    return NextResponse.json({
      success: true,
      topics_processed: topics.length,
      stories_added: totalAdded,
      stories_cleaned: cleaned || 0,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("News refresh error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
