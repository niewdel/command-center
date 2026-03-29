import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  detectSource,
  getYouTubeTranscript,
  getInstagramTranscript,
} from "@/lib/digest/extract";
import { analyzeTranscript } from "@/lib/digest/analyze";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function postSlackReply(
  channelId: string,
  threadTs: string,
  text: string
) {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token || !channelId || !threadTs) return;

  await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      channel: channelId,
      thread_ts: threadTs,
      text,
    }),
  });
}

export async function POST(request: NextRequest) {
  try {
    // Verify internal secret
    const authHeader = request.headers.get("authorization");
    const expectedSecret = process.env.DIGEST_PROCESS_SECRET;
    if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { digestId } = await request.json();
    if (!digestId) {
      return NextResponse.json(
        { error: "digestId is required" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Fetch the digest record
    const { data: digest, error: fetchError } = await supabase
      .from("content_digests")
      .select("*")
      .eq("id", digestId)
      .single();

    if (fetchError || !digest) {
      return NextResponse.json({ error: "Digest not found" }, { status: 404 });
    }

    // Mark as processing
    await supabase
      .from("content_digests")
      .update({ status: "processing", updated_at: new Date().toISOString() })
      .eq("id", digestId);

    try {
      const { source } = detectSource(digest.url);
      let transcript: string;
      let title: string;
      let thumbnail_url: string | null = null;

      if (source === "youtube") {
        const videoIdMatch = digest.url.match(
          /(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
        );
        if (!videoIdMatch) throw new Error("Invalid YouTube URL");

        const result = await getYouTubeTranscript(videoIdMatch[1]);
        transcript = result.transcript;
        title = result.title;
        thumbnail_url = result.thumbnail_url;
      } else if (source === "instagram") {
        const openaiKey = process.env.OPENAI_API_KEY;
        if (!openaiKey) throw new Error("OPENAI_API_KEY not configured for Instagram transcription");

        const result = await getInstagramTranscript(digest.url, openaiKey);
        transcript = result.transcript;
        title = result.title;
        thumbnail_url = result.thumbnail_url;
      } else {
        throw new Error(`Unsupported source: ${source}`);
      }

      // Analyze with Claude
      const anthropicKey = process.env.ANTHROPIC_API_KEY;
      if (!anthropicKey) throw new Error("ANTHROPIC_API_KEY not configured");

      const analysis = await analyzeTranscript(
        transcript,
        title,
        digest.url,
        anthropicKey
      );

      // Update the digest with results
      await supabase
        .from("content_digests")
        .update({
          status: "completed",
          title,
          thumbnail_url,
          transcript,
          guide: analysis.guide,
          tags: analysis.tags,
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", digestId);

      // Reply in Slack thread
      if (digest.slack_channel_id && digest.slack_message_ts) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "your-app-url";
        await postSlackReply(
          digest.slack_channel_id,
          digest.slack_message_ts,
          `✅ *${title}*\nGuide ready → ${appUrl}/digests?id=${digestId}`
        );
      }

      return NextResponse.json({ success: true, digestId });
    } catch (processError) {
      const errorMessage =
        processError instanceof Error
          ? processError.message
          : "Unknown processing error";

      await supabase
        .from("content_digests")
        .update({
          status: "failed",
          error_message: errorMessage,
          updated_at: new Date().toISOString(),
        })
        .eq("id", digestId);

      // Notify failure in Slack
      if (digest.slack_channel_id && digest.slack_message_ts) {
        await postSlackReply(
          digest.slack_channel_id,
          digest.slack_message_ts,
          `❌ Failed to process: ${errorMessage}`
        );
      }

      return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
  } catch (error) {
    console.error("Process error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
