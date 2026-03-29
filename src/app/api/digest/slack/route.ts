import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { detectSource } from "@/lib/digest/extract";

// Use service role key for Slack webhook (no user session)
function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Slack URL verification challenge
    if (body.type === "url_verification") {
      return NextResponse.json({ challenge: body.challenge });
    }

    // Verify Slack signing secret (basic check)
    const slackToken = process.env.SLACK_VERIFICATION_TOKEN;
    if (slackToken && body.token !== slackToken) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
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
      const urls = urlMatches.map((m) => m.replace(/^</, ""));

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
