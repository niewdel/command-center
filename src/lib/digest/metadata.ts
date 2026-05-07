// Lightweight metadata fetch for inspiration saves — title + thumbnail only, no transcription.

type LightMeta = {
  title: string | null;
  thumbnail_url: string | null;
};

export async function fetchLightMetadata(
  url: string,
  source: "youtube" | "instagram" | "tiktok" | "unknown"
): Promise<LightMeta> {
  if (source === "youtube") return fetchYouTubeMeta(url);
  if (source === "tiktok") return fetchTikTokMeta(url);
  if (source === "instagram") return fetchInstagramMeta(url);
  return { title: null, thumbnail_url: null };
}

async function fetchYouTubeMeta(url: string): Promise<LightMeta> {
  const idMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  const videoId = idMatch?.[1];
  let title: string | null = null;

  try {
    const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
    if (res.ok) {
      const data = await res.json();
      title = data.title || null;
    }
  } catch {
    // ignore
  }

  return {
    title,
    thumbnail_url: videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null,
  };
}

async function fetchTikTokMeta(url: string): Promise<LightMeta> {
  try {
    const res = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`);
    if (!res.ok) return { title: null, thumbnail_url: null };
    const data = await res.json();
    const author = data.author_name ? `@${data.author_name}` : "";
    const title = [author, data.title].filter(Boolean).join(" — ") || null;
    return { title, thumbnail_url: data.thumbnail_url || null };
  } catch {
    return { title: null, thumbnail_url: null };
  }
}

async function fetchInstagramMeta(_url: string): Promise<LightMeta> {
  // Instagram oEmbed requires an FB app token now. For inspirations we accept no thumbnail —
  // the videos page falls back to a source-icon placeholder. URL itself is enough.
  return { title: null, thumbnail_url: null };
}
