import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getValidToken } from "@/lib/integrations/token-refresh";
import { fetchGmailMessages, fetchGmailHistory } from "@/lib/integrations/google";
import { fetchOutlookMessages, fetchOutlookDelta } from "@/lib/integrations/microsoft";
import { classifyInboxItems } from "@/lib/ai/inbox-classifier";
import type { EmailConnection } from "@/types/database";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  // Get all active email connections
  const { data: connections } = await supabase
    .from("email_connections")
    .select("*")
    .eq("is_active", true);

  if (!connections || connections.length === 0) {
    return NextResponse.json({ message: "No active connections" });
  }

  const results: { connectionId: string; synced: number; error?: string }[] = [];

  for (const conn of connections as EmailConnection[]) {
    try {
      const accessToken = await getValidToken(conn);
      let messages: { id: string; threadId?: string; subject: string; snippet: string; senderName: string; senderEmail: string; recipients: { email: string; name?: string; type: string }[]; receivedAt: string; isRead: boolean; hasAttachments: boolean; labels: string[] }[] = [];

      if (conn.provider === "google") {
        if (conn.sync_cursor) {
          const result = await fetchGmailHistory(accessToken, conn.sync_cursor);
          messages = result.messages;
          await supabase.from("email_connections").update({ sync_cursor: result.newHistoryId, last_synced_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", conn.id);
        } else {
          messages = await fetchGmailMessages(accessToken, 50);
        }
      } else if (conn.provider === "microsoft") {
        if (conn.sync_cursor) {
          const result = await fetchOutlookDelta(accessToken, conn.sync_cursor);
          messages = result.messages;
          await supabase.from("email_connections").update({ sync_cursor: result.newDeltaLink, last_synced_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", conn.id);
        } else {
          messages = await fetchOutlookMessages(accessToken, 50);
        }
      }

      // Upsert messages
      for (const msg of messages) {
        await supabase.from("inbox_items").upsert({
          user_id: conn.user_id,
          connection_id: conn.id,
          provider: conn.provider,
          external_id: msg.id,
          thread_id: msg.threadId || null,
          subject: msg.subject,
          snippet: msg.snippet,
          sender_name: msg.senderName,
          sender_email: msg.senderEmail,
          recipients: msg.recipients,
          received_at: msg.receivedAt,
          is_read: msg.isRead,
          has_attachments: msg.hasAttachments,
          labels: msg.labels,
        }, { onConflict: "connection_id,external_id" });
      }

      results.push({ connectionId: conn.id, synced: messages.length });
    } catch (error) {
      results.push({
        connectionId: conn.id,
        synced: 0,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Classify unclassified items
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey) {
    const { data: unclassified } = await supabase
      .from("inbox_items")
      .select("id, subject, snippet, sender_email")
      .is("ai_category", null)
      .order("received_at", { ascending: false })
      .limit(20);

    if (unclassified && unclassified.length > 0) {
      try {
        const classifications = await classifyInboxItems(
          unclassified.map((item) => ({
            id: item.id,
            subject: item.subject || "",
            snippet: item.snippet || "",
            senderEmail: item.sender_email || "",
          })),
          anthropicKey
        );

        for (const c of classifications) {
          await supabase.from("inbox_items").update({
            ai_category: c.category,
            ai_confidence: c.confidence,
            ai_summary: c.summary,
            ai_classified_at: new Date().toISOString(),
          }).eq("id", c.id);
        }
      } catch (err) {
        console.error("Classification failed:", err);
      }
    }
  }

  return NextResponse.json({ results });
}
