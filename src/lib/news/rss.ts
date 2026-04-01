import Parser from "rss-parser";

export type RSSItem = {
  title: string;
  url: string;
  source_name: string;
  published_at: string | null;
  snippet: string;
};

const parser = new Parser({
  timeout: 8000,
  headers: {
    "User-Agent": "CommandCenter/1.0 (RSS aggregator)",
  },
});

export async function fetchRSSFeeds(feedUrls: string[]): Promise<RSSItem[]> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const results: RSSItem[] = [];

  await Promise.allSettled(
    feedUrls.map(async (feedUrl) => {
      try {
        const feed = await parser.parseURL(feedUrl);
        const sourceName = feed.title || new URL(feedUrl).hostname;

        for (const item of feed.items || []) {
          if (!item.title || !item.link) continue;

          const pubDate = item.pubDate || item.isoDate;
          const publishedAt = pubDate ? new Date(pubDate) : null;

          // Skip articles older than 24 hours
          if (publishedAt && publishedAt < cutoff) continue;

          const snippet =
            item.contentSnippet?.slice(0, 300) ||
            item.content?.replace(/<[^>]+>/g, "").slice(0, 300) ||
            item.summary?.slice(0, 300) ||
            "";

          results.push({
            title: item.title.trim(),
            url: item.link.trim(),
            source_name: sourceName,
            published_at: publishedAt?.toISOString() || null,
            snippet: snippet.trim(),
          });
        }
      } catch {
        // Skip failing feeds silently
      }
    })
  );

  // Sort by recency
  return results.sort((a, b) => {
    const dateA = a.published_at ? new Date(a.published_at).getTime() : 0;
    const dateB = b.published_at ? new Date(b.published_at).getTime() : 0;
    return dateB - dateA;
  });
}
