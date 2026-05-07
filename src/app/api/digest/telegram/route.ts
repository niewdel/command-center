import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { detectSource } from "@/lib/digest/extract";
import { fetchLightMetadata } from "@/lib/digest/metadata";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

type InlineKeyboardButton = {
  text: string;
  callback_data?: string;
  url?: string;
};

type ReplyMarkup = {
  inline_keyboard: InlineKeyboardButton[][];
};

export async function POST(request: NextRequest) {
  try {
    const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (secretToken) {
      const headerToken = request.headers.get("x-telegram-bot-api-secret-token");
      if (headerToken !== secretToken) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const update = await request.json();

    if (update.callback_query) {
      return handleCallbackQuery(update.callback_query);
    }

    return handleMessage(update.message);
  } catch (error) {
    console.error("Telegram webhook error:", error);
    return NextResponse.json({ ok: true });
  }
}

async function handleMessage(message: {
  text?: string;
  chat?: { id: number };
  message_id?: number;
} | undefined) {
  if (!message?.text) return NextResponse.json({ ok: true });

  const urls = message.text.match(/https?:\/\/[^\s]+/g) || [];
  if (urls.length === 0) return NextResponse.json({ ok: true });

  const supabase = getSupabaseAdmin();
  const { data: users } = await supabase.auth.admin.listUsers();
  const userId = users?.users?.[0]?.id;
  if (!userId) {
    console.error("No user found in Supabase");
    return NextResponse.json({ ok: true });
  }

  const chatId = message.chat!.id;
  const messageId = message.message_id!;

  for (const url of urls) {
    const { source } = detectSource(url);
    if (source === "unknown") continue;

    const { data: existing } = await supabase
      .from("content_digests")
      .select("id, kind")
      .eq("url", url)
      .limit(1);

    if (existing && existing.length > 0) {
      await sendTelegramReply(
        String(chatId),
        messageId,
        `Already saved as ${existing[0].kind === "inspiration" ? "💡 inspiration" : "📚 digest"}.`
      );
      continue;
    }

    // Queue with kind=digest by default. The user picks the real kind via the inline keyboard.
    const { data: digest, error } = await supabase
      .from("content_digests")
      .insert({
        user_id: userId,
        url,
        source,
        status: "queued",
        kind: "digest",
        telegram_chat_id: String(chatId),
        telegram_message_id: messageId,
      })
      .select("id")
      .single();

    if (error || !digest) {
      console.error("Failed to queue digest:", error);
      continue;
    }

    const sourceEmoji = source === "youtube" ? "▶️" : source === "instagram" ? "📷" : source === "tiktok" ? "🎵" : "🔗";
    await sendTelegramReply(
      String(chatId),
      messageId,
      `${sourceEmoji} Saved. Pick a bucket:`,
      {
        inline_keyboard: [
          [
            { text: "📚 Digest (analyze)", callback_data: `kind:digest:${digest.id}` },
            { text: "💡 Inspiration (save only)", callback_data: `kind:inspo:${digest.id}` },
          ],
        ],
      }
    );
  }

  return NextResponse.json({ ok: true });
}

async function handleCallbackQuery(query: {
  id: string;
  data?: string;
  message?: { chat: { id: number }; message_id: number };
}) {
  const data = query.data || "";
  const match = data.match(/^kind:(digest|inspo):([0-9a-f-]+)$/i);
  if (!match) {
    await answerCallbackQuery(query.id, "Unknown action");
    return NextResponse.json({ ok: true });
  }

  const [, kindShort, digestId] = match;
  const kind = kindShort === "inspo" ? "inspiration" : "digest";
  const supabase = getSupabaseAdmin();

  const { data: digest, error: fetchErr } = await supabase
    .from("content_digests")
    .select("*")
    .eq("id", digestId)
    .single();

  if (fetchErr || !digest) {
    await answerCallbackQuery(query.id, "Digest not found");
    return NextResponse.json({ ok: true });
  }

  if (kind === "inspiration") {
    const meta = await fetchLightMetadata(digest.url, digest.source).catch((err) => {
      console.error("fetchLightMetadata failed:", err);
      return { title: null, thumbnail_url: null };
    });

    await supabase
      .from("content_digests")
      .update({
        kind: "inspiration",
        status: "completed",
        title: meta.title || digest.title,
        thumbnail_url: meta.thumbnail_url || digest.thumbnail_url,
        processed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", digestId);

    await answerCallbackQuery(query.id, "Saved as inspiration");
    if (query.message) {
      await editTelegramMessage(
        String(query.message.chat.id),
        query.message.message_id,
        `💡 Saved as inspiration${meta.title ? `\n_${escapeMd(meta.title)}_` : ""}`
      );
    }
    return NextResponse.json({ ok: true });
  }

  // kind === "digest"
  await supabase
    .from("content_digests")
    .update({ kind: "digest", updated_at: new Date().toISOString() })
    .eq("id", digestId);

  await answerCallbackQuery(query.id, "Digesting...");
  if (query.message) {
    await editTelegramMessage(
      String(query.message.chat.id),
      query.message.message_id,
      "📚 Digesting…"
    );
  }

  const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    await sendTelegramReply(
      String(digest.telegram_chat_id),
      digest.telegram_message_id,
      "Error: APP_URL not configured"
    );
    return NextResponse.json({ ok: true });
  }

  try {
    const res = await fetch(`${appUrl}/api/digest/process`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.DIGEST_PROCESS_SECRET}`,
      },
      body: JSON.stringify({ digestId }),
    });
    if (!res.ok) {
      const body = await res.text();
      await sendTelegramReply(
        String(digest.telegram_chat_id),
        digest.telegram_message_id,
        `Processing failed (${res.status}): ${body.slice(0, 200)}`
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    await sendTelegramReply(
      String(digest.telegram_chat_id),
      digest.telegram_message_id,
      `Failed to reach process endpoint: ${msg}`
    );
  }

  return NextResponse.json({ ok: true });
}

async function sendTelegramReply(
  chatId: string,
  replyToMessageId: number,
  text: string,
  replyMarkup?: ReplyMarkup
) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;

  const body: Record<string, unknown> = {
    chat_id: chatId,
    reply_to_message_id: replyToMessageId,
    text,
    parse_mode: "Markdown",
  };
  if (replyMarkup) body.reply_markup = replyMarkup;

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function editTelegramMessage(chatId: string, messageId: number, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;

  await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: "Markdown",
    }),
  });
}

async function answerCallbackQuery(callbackQueryId: string, text?: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;

  await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      text: text || "",
    }),
  });
}

function escapeMd(text: string): string {
  return text.replace(/[_*`[\]]/g, (c) => `\\${c}`);
}
