import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { detectSource } from "@/lib/digest/extract";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: NextRequest) {
  try {
    // Verify Telegram bot token in the webhook URL path
    const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (secretToken) {
      const headerToken = request.headers.get("x-telegram-bot-api-secret-token");
      if (headerToken !== secretToken) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const update = await request.json();

    // Only handle messages with text
    const message = update.message;
    if (!message?.text) {
      return NextResponse.json({ ok: true });
    }

    // Extract URLs from the message
    const urls = message.text.match(/https?:\/\/[^\s]+/g) || [];
    if (urls.length === 0) {
      return NextResponse.json({ ok: true });
    }

    const supabase = getSupabaseAdmin();

    // Get user ID — single-user app, grab the first user
    const { data: users } = await supabase.auth.admin.listUsers();
    const userId = users?.users?.[0]?.id;

    if (!userId) {
      console.error("No user found in Supabase");
      return NextResponse.json({ ok: true });
    }

    const chatId = message.chat.id;
    const messageId = message.message_id;

    for (const url of urls) {
      const { source } = detectSource(url);

      // Skip non-video URLs
      if (source === "unknown") continue;

      // Check for duplicate URLs
      const { data: existing } = await supabase
        .from("content_digests")
        .select("id")
        .eq("url", url)
        .limit(1);

      if (existing && existing.length > 0) {
        await sendTelegramReply(chatId, messageId, "Already digested this one.");
        continue;
      }

      // Queue the digest
      const { data: digest, error } = await supabase
        .from("content_digests")
        .insert({
          user_id: userId,
          url,
          source,
          status: "queued",
          telegram_chat_id: String(chatId),
          telegram_message_id: messageId,
        })
        .select("id")
        .single();

      if (error) {
        console.error("Failed to queue digest:", error);
        continue;
      }

      // Acknowledge receipt
      await sendTelegramReply(chatId, messageId, `Queued for processing...`);

      // Trigger async processing
      const processUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/digest/process`;
      fetch(processUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.DIGEST_PROCESS_SECRET}`,
        },
        body: JSON.stringify({ digestId: digest.id }),
      }).catch((err) => console.error("Failed to trigger processing:", err));
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Telegram webhook error:", error);
    return NextResponse.json({ ok: true });
  }
}

async function sendTelegramReply(
  chatId: number,
  replyToMessageId: number,
  text: string
) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;

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
