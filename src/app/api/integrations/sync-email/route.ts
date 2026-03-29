import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getValidToken } from "@/lib/integrations/token-refresh";
import { fetchGmailMessages, fetchGmailHistory, GmailMessage } from "@/lib/integrations/google";
import { fetchOutlookMessages, fetchOutlookDelta, OutlookMessage } from "@/lib/integrations/microsoft";
import { EmailConnection } from "@/types/database";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

type NormalizedMessage = {
  id: string;
  threadId: string;
  subject: string;
  snippet: string;
  senderName: string;
  senderEmail: string;
  recipients: { email: string; name?: string; type: "to" | "cc" | "bcc" }[];
  receivedAt: string;
  isRead: boolean;
  hasAttachments: boolean;
  labels: string[];
};

export async function POST(request: NextRequest) {
  try {
    // Verify internal secret
    const authHeader = request.headers.get("authorization");
    const expectedSecret = process.env.DIGEST_PROCESS_SECRET;
    if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { connectionId } = await request.json();
    if (!connectionId) {
      return NextResponse.json(
        { error: "connectionId is required" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Fetch connection record
    const { data: connection, error: connError } = await supabase
      .from("email_connections")
      .select("*")
      .eq("id", connectionId)
      .single();

    if (connError || !connection) {
      return NextResponse.json(
        { error: "Connection not found" },
        { status: 404 }
      );
    }

    const conn = connection as EmailConnection;

    if (!conn.is_active) {
      return NextResponse.json(
        { error: "Connection is inactive" },
        { status: 400 }
      );
    }

    // Get a valid access token (refreshes if needed)
    const accessToken = await getValidToken(conn);

    let messages: NormalizedMessage[] = [];
    let newSyncCursor: string | null = null;

    if (conn.provider === "google") {
      if (conn.sync_cursor) {
        // Incremental sync via history
        const result = await fetchGmailHistory(accessToken, conn.sync_cursor);
        messages = result.messages;
        newSyncCursor = result.newHistoryId;
      } else {
        // Initial full sync
        const gmailMessages = await fetchGmailMessages(accessToken, 50);
        messages = gmailMessages;
        // Get the latest historyId for future incremental syncs
        if (gmailMessages.length > 0) {
          const profileRes = await fetch(
            "https://gmail.googleapis.com/gmail/v1/users/me/profile",
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );
          if (profileRes.ok) {
            const profile = await profileRes.json();
            newSyncCursor = profile.historyId;
          }
        }
      }
    } else if (conn.provider === "microsoft") {
      if (conn.sync_cursor) {
        // Incremental sync via delta
        const result = await fetchOutlookDelta(accessToken, conn.sync_cursor);
        messages = result.messages;
        newSyncCursor = result.newDeltaLink;
      } else {
        // Initial full sync
        const outlookMessages = await fetchOutlookMessages(accessToken, 50);
        messages = outlookMessages;
        // Set up delta link for future syncs
        const deltaInitUrl =
          "https://graph.microsoft.com/v1.0/me/messages/delta?$select=id,subject,bodyPreview,from,toRecipients,ccRecipients,receivedDateTime,isRead,hasAttachments,conversationId,categories";
        const deltaRes = await fetch(deltaInitUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (deltaRes.ok) {
          const deltaData = await deltaRes.json();
          // Walk through all pages to get the final delta link
          let nextLink = deltaData["@odata.nextLink"];
          let deltaLink = deltaData["@odata.deltaLink"];
          while (nextLink && !deltaLink) {
            const pageRes = await fetch(nextLink, {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (!pageRes.ok) break;
            const pageData = await pageRes.json();
            nextLink = pageData["@odata.nextLink"];
            deltaLink = pageData["@odata.deltaLink"];
          }
          if (deltaLink) {
            newSyncCursor = deltaLink;
          }
        }
      }
    }

    // Upsert messages into inbox_items
    let syncedCount = 0;
    for (const msg of messages) {
      const { error: upsertError } = await supabase
        .from("inbox_items")
        .upsert(
          {
            user_id: conn.user_id,
            connection_id: conn.id,
            provider: conn.provider,
            external_id: msg.id,
            thread_id: msg.threadId,
            subject: msg.subject,
            snippet: msg.snippet,
            sender_name: msg.senderName,
            sender_email: msg.senderEmail,
            recipients: msg.recipients,
            received_at: msg.receivedAt,
            is_read: msg.isRead,
            has_attachments: msg.hasAttachments,
            labels: msg.labels,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "connection_id,external_id" }
        );

      if (!upsertError) {
        syncedCount++;
      } else {
        console.error(`Failed to upsert message ${msg.id}:`, upsertError);
      }
    }

    // Update connection sync state
    const updatePayload: Record<string, unknown> = {
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (newSyncCursor) {
      updatePayload.sync_cursor = newSyncCursor;
    }

    await supabase
      .from("email_connections")
      .update(updatePayload)
      .eq("id", conn.id);

    return NextResponse.json({ success: true, synced: syncedCount });
  } catch (error) {
    console.error("Email sync error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
