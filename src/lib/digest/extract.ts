// Transcript extraction for YouTube and Instagram

const YOUTUBE_REGEX =
  /(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
const INSTAGRAM_REGEX =
  /(?:instagram\.com\/(?:reel|p|reels)\/)([\w-]+)/;

export function detectSource(url: string): {
  source: "youtube" | "instagram" | "unknown";
  videoId: string | null;
} {
  const ytMatch = url.match(YOUTUBE_REGEX);
  if (ytMatch) return { source: "youtube", videoId: ytMatch[1] };

  const igMatch = url.match(INSTAGRAM_REGEX);
  if (igMatch) return { source: "instagram", videoId: igMatch[1] };

  return { source: "unknown", videoId: null };
}

export async function getYouTubeTranscript(videoId: string): Promise<{
  transcript: string;
  title: string;
  thumbnail_url: string;
}> {
  // Fetch the YouTube page to get title and auto-generated captions
  const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    },
  });
  const html = await pageRes.text();

  // Extract title
  const titleMatch = html.match(/<title>(.+?)<\/title>/);
  const title = titleMatch
    ? titleMatch[1].replace(" - YouTube", "").trim()
    : "Untitled Video";

  const thumbnail_url = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

  // Extract captions URL from the page's ytInitialPlayerResponse
  const captionsMatch = html.match(/"captionTracks":(\[.*?\])/);
  if (!captionsMatch) {
    throw new Error(
      "No captions available for this video. It may not have auto-generated subtitles."
    );
  }

  const captionTracks = JSON.parse(captionsMatch[1]);
  // Prefer English, fall back to first available
  const track =
    captionTracks.find(
      (t: { languageCode: string }) => t.languageCode === "en"
    ) || captionTracks[0];

  if (!track?.baseUrl) {
    throw new Error("Could not find caption track URL");
  }

  // Fetch the captions XML
  const captionRes = await fetch(track.baseUrl);
  const captionXml = await captionRes.text();

  // Parse XML captions into plain text
  const textSegments = captionXml.match(/<text[^>]*>(.*?)<\/text>/g) || [];
  const transcript = textSegments
    .map((seg) =>
      seg
        .replace(/<[^>]+>/g, "")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\n/g, " ")
    )
    .join(" ")
    .trim();

  if (!transcript) {
    throw new Error("Captions were found but contained no text");
  }

  return { transcript, title, thumbnail_url };
}

export async function getInstagramTranscript(
  url: string,
  openaiApiKey: string
): Promise<{
  transcript: string;
  title: string;
  thumbnail_url: string | null;
}> {
  // For Instagram, we need to:
  // 1. Download the video audio
  // 2. Send to Whisper for transcription
  //
  // We use a public embed endpoint to get video URL
  const oembedRes = await fetch(
    `https://api.instagram.com/oembed/?url=${encodeURIComponent(url)}`
  );

  if (!oembedRes.ok) {
    throw new Error(
      "Could not fetch Instagram post metadata. The post may be private."
    );
  }

  const oembed = await oembedRes.json();
  const title = oembed.title || "Instagram Reel";
  const thumbnail_url = oembed.thumbnail_url || null;

  // For audio extraction from Instagram, we need a proxy approach.
  // Use a lightweight fetch to get the video URL from the page.
  const pageRes = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    },
  });
  const html = await pageRes.text();

  // Try to extract video URL from meta tags
  const videoUrlMatch = html.match(
    /property="og:video"\s+content="([^"]+)"/
  );

  if (!videoUrlMatch) {
    throw new Error(
      "Could not extract video URL from Instagram. The post may be private or not a video."
    );
  }

  const videoUrl = videoUrlMatch[1];

  // Download the video
  const videoRes = await fetch(videoUrl);
  const videoBuffer = await videoRes.arrayBuffer();

  // Send to OpenAI Whisper for transcription
  const formData = new FormData();
  formData.append(
    "file",
    new Blob([videoBuffer], { type: "video/mp4" }),
    "video.mp4"
  );
  formData.append("model", "whisper-1");
  formData.append("language", "en");

  const whisperRes = await fetch(
    "https://api.openai.com/v1/audio/transcriptions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
      },
      body: formData,
    }
  );

  if (!whisperRes.ok) {
    const err = await whisperRes.text();
    throw new Error(`Whisper transcription failed: ${err}`);
  }

  const whisperData = await whisperRes.json();
  return {
    transcript: whisperData.text,
    title,
    thumbnail_url,
  };
}
