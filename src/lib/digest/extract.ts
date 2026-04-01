// Transcript extraction for YouTube and Instagram

import { YoutubeTranscript } from "youtube-transcript";

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
  // Get title from YouTube oEmbed (reliable, no scraping)
  let title = "Untitled Video";
  try {
    const oembedRes = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
    );
    if (oembedRes.ok) {
      const oembed = await oembedRes.json();
      title = oembed.title || title;
    }
  } catch {
    // Fall back to generic title
  }

  const thumbnail_url = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

  // Use youtube-transcript library for reliable caption extraction
  let segments;
  try {
    segments = await YoutubeTranscript.fetchTranscript(videoId, { lang: "en" });
  } catch {
    // Retry without language preference (some videos only have auto-generated in other languages)
    try {
      segments = await YoutubeTranscript.fetchTranscript(videoId);
    } catch (retryErr) {
      throw new Error(
        `No transcript available for this video. It may not have captions enabled. ${retryErr instanceof Error ? retryErr.message : ""}`
      );
    }
  }

  if (!segments || segments.length === 0) {
    throw new Error("Transcript was found but contained no text segments");
  }

  // Join segments into clean text, preserving natural sentence breaks
  const transcript = segments
    .map((seg) => seg.text.replace(/\n/g, " ").trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (!transcript) {
    throw new Error("Transcript segments were empty after processing");
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
  // Fetch metadata via oEmbed
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

  // Extract video URL from the page's og:video meta tag
  const pageRes = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    },
  });
  const html = await pageRes.text();

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

  // Transcribe via OpenAI Whisper
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
