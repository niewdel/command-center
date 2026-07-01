import { NextRequest, NextResponse } from "next/server";
import { secureCompare } from "@/lib/secure-compare";
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

async function sendTelegramReply(
  chatId: string,
  replyToMessageId: number,
  text: string
) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !chatId) return;

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      reply_to_message_id: replyToMessageId,
      text,
      parse_mode: "Markdown",
    }),
  });
}

export async function POST(request: NextRequest) {
  try {
    // Verify internal secret. Fail CLOSED: this endpoint is reachable without
    // a login session (server loopback calls it with a Bearer token), so a
    // missing secret must reject, never wave everyone through.
    const authHeader = request.headers.get("authorization");
    const expectedSecret = process.env.DIGEST_PROCESS_SECRET?.trim();
    const token = authHeader?.replace("Bearer ", "").trim();
    if (!expectedSecret || !secureCompare(token, expectedSecret)) {
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

      // Fetch user's digest context for personalization
      let userContext: string | null = null;
      const { data: settings } = await supabase
        .from("user_settings")
        .select("digest_context")
        .eq("user_id", digest.user_id)
        .single();

      if (settings?.digest_context) {
        userContext = settings.digest_context;
      }

      // Analyze with Claude
      const anthropicKey = process.env.ANTHROPIC_API_KEY;
      if (!anthropicKey) throw new Error("ANTHROPIC_API_KEY not configured");

      const analysis = await analyzeTranscript(
        transcript,
        title,
        digest.url,
        anthropicKey,
        userContext
      );

      // Use AI-generated title for generic titles (e.g. "Instagram Reel")
      const finalTitle =
        analysis.generatedTitle && (!title || title === "Instagram Reel")
          ? analysis.generatedTitle
          : title;

      // Update the digest with results
      await supabase
        .from("content_digests")
        .update({
          status: "completed",
          title: finalTitle,
          thumbnail_url,
          transcript,
          guide: analysis.guide,
          tags: analysis.tags,
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", digestId);

      // Reply in Telegram
      if (digest.telegram_chat_id && digest.telegram_message_id) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "your-app-url";
        const verdict = analysis.guide.match(/## Verdict\n+([\s\S]*?)(?=\n##)/)?.[1]?.trim() || "";
        const shortVerdict = verdict.length > 200 ? verdict.slice(0, 200) + "..." : verdict;
        await sendTelegramReply(
          digest.telegram_chat_id,
          digest.telegram_message_id,
          `*${finalTitle}*\n${shortVerdict}\n\n[Full guide](${appUrl}/videos?id=${digestId})`
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

      // Notify failure in Telegram
      if (digest.telegram_chat_id && digest.telegram_message_id) {
        await sendTelegramReply(
          digest.telegram_chat_id,
          digest.telegram_message_id,
          `Failed to process: ${errorMessage}`
        );
      }

      return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Process error:", msg);
    return NextResponse.json(
      { error: msg },
      { status: 500 }
    );
  }
}
