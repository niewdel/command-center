import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHmac, timingSafeEqual } from "crypto";
import { detectSource } from "@/lib/digest/extract";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Verify Slack request signature using HMAC-SHA256
function verifySlackSignature(
  signingSecret: string,
  timestamp: string,
  body: string,
  signature: string
): boolean {
  // Reject requests older than 5 minutes (replay protection)
  const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 60 * 5;
  if (parseInt(timestamp, 10) < fiveMinutesAgo) return false;

  const sigBasestring = `v0:${timestamp}:${body}`;
  const hmac = createHmac("sha256", signingSecret);
  hmac.update(sigBasestring);
  const computed = `v0=${hmac.digest("hex")}`;

  try {
    return timingSafeEqual(Buffer.from(computed), Buffer.from(signature));
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const body = JSON.parse(rawBody);

    // Slack URL verification challenge (no signature check needed)
    if (body.type === "url_verification") {
      return NextResponse.json({ challenge: body.challenge });
    }

    // Verify Slack signing secret (HMAC-SHA256)
    const signingSecret = process.env.SLACK_SIGNING_SECRET;
    if (signingSecret) {
      const timestamp = request.headers.get("x-slack-request-timestamp") || "";
      const signature = request.headers.get("x-slack-signature") || "";

      if (!verifySlackSignature(signingSecret, timestamp, rawBody, signature)) {
        console.error("Slack signature verification failed");
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    }

    // Handle event callbacks
    if (body.type === "event_callback") {
      const event = body.event;

      // Only process messages (not bot messages or edits)
      if (
        event.type !== "message" ||
        event.subtype ||
        event.bot_id
      ) {
        return NextResponse.json({ ok: true });
      }

      const text: string = event.text || "";

      // Extract URLs from the message
      // Slack wraps URLs in <url> or <url|label> format
      const urlMatches = text.match(/<(https?:\/\/[^|>]+)/g) || [];
      const urls = urlMatches.map((m: string) => m.replace(/^</, ""));

      // Also check for plain URLs
      const plainUrls =
        text.match(/https?:\/\/[^\s<>]+/g) || [];
      const allUrls = [...new Set([...urls, ...plainUrls])];

      if (allUrls.length === 0) {
        return NextResponse.json({ ok: true });
      }

      const supabase = getSupabaseAdmin();

      // Get the user ID — for now, use the first user (single-user app)
      // In future, map Slack user IDs to Supabase users
      const { data: users } = await supabase.auth.admin.listUsers();
      const userId = users?.users?.[0]?.id;

      if (!userId) {
        console.error("No user found in Supabase");
        return NextResponse.json({ ok: true });
      }

      for (const url of allUrls) {
        const { source } = detectSource(url);

        // Skip non-video URLs
        if (source === "unknown") continue;

        // Check for duplicate URLs
        const { data: existing } = await supabase
          .from("content_digests")
          .select("id")
          .eq("url", url)
          .limit(1);

        if (existing && existing.length > 0) continue;

        // Queue the digest
        const { data: digest, error } = await supabase
          .from("content_digests")
          .insert({
            user_id: userId,
            url,
            source,
            status: "queued",
            slack_message_ts: event.ts,
            slack_channel_id: event.channel,
          })
          .select("id")
          .single();

        if (error) {
          console.error("Failed to queue digest:", error);
          continue;
        }

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
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Slack webhook error:", error);
    // Always return 200 to Slack to prevent retries
    return NextResponse.json({ ok: true });
  }
}
