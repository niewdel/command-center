export type GmailMessage = {
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

const GMAIL_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

function parseEmailAddress(raw: string): { name: string; email: string } {
  const match = raw.match(/^(.+?)\s*<(.+?)>$/);
  if (match) {
    return { name: match[1].trim().replace(/^"|"$/g, ""), email: match[2] };
  }
  return { name: raw, email: raw };
}

function getHeader(
  headers: { name: string; value: string }[],
  name: string
): string {
  return headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function parseGmailMessage(msg: Record<string, unknown>): GmailMessage {
  const payload = msg.payload as {
    headers: { name: string; value: string }[];
    parts?: { filename?: string }[];
  };
  const headers = payload?.headers ?? [];

  const from = getHeader(headers, "From");
  const { name: senderName, email: senderEmail } = parseEmailAddress(from);

  const toRaw = getHeader(headers, "To");
  const recipients = toRaw
    .split(",")
    .filter(Boolean)
    .map((r) => {
      const { name, email } = parseEmailAddress(r.trim());
      return { email, name: name !== email ? name : undefined, type: "to" as const };
    });

  const dateStr = getHeader(headers, "Date");
  const labelIds = (msg.labelIds as string[]) ?? [];

  return {
    id: msg.id as string,
    threadId: msg.threadId as string,
    subject: getHeader(headers, "Subject"),
    snippet: (msg.snippet as string) ?? "",
    senderName,
    senderEmail,
    recipients,
    receivedAt: dateStr ? new Date(dateStr).toISOString() : new Date().toISOString(),
    isRead: !labelIds.includes("UNREAD"),
    hasAttachments: (payload?.parts ?? []).some((p) => p.filename && p.filename.length > 0),
    labels: labelIds,
  };
}

export async function fetchGmailMessages(
  accessToken: string,
  maxResults: number = 50
): Promise<GmailMessage[]> {
  // Step 1: Get message IDs
  const listUrl = `${GMAIL_BASE}/messages?maxResults=${maxResults}&labelIds=INBOX`;
  const listRes = await fetch(listUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!listRes.ok) {
    throw new Error(`Gmail list failed (${listRes.status}): ${await listRes.text()}`);
  }

  const listData = await listRes.json();
  const messageStubs: { id: string }[] = listData.messages ?? [];

  if (messageStubs.length === 0) return [];

  // Step 2: Fetch each message's metadata
  const messages: GmailMessage[] = [];
  // Batch in groups of 10 to avoid rate limits
  const batchSize = 10;
  for (let i = 0; i < messageStubs.length; i += batchSize) {
    const batch = messageStubs.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(async ({ id }) => {
        const msgUrl = `${GMAIL_BASE}/messages/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Date`;
        const msgRes = await fetch(msgUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!msgRes.ok) return null;
        return msgRes.json();
      })
    );

    for (const msg of batchResults) {
      if (msg) {
        messages.push(parseGmailMessage(msg));
      }
    }
  }

  return messages;
}

export async function fetchGmailHistory(
  accessToken: string,
  startHistoryId: string
): Promise<{ messages: GmailMessage[]; newHistoryId: string }> {
  const historyUrl = `${GMAIL_BASE}/history?startHistoryId=${startHistoryId}&historyTypes=messageAdded`;
  const historyRes = await fetch(historyUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!historyRes.ok) {
    throw new Error(`Gmail history failed (${historyRes.status}): ${await historyRes.text()}`);
  }

  const historyData = await historyRes.json();
  const newHistoryId: string = historyData.historyId ?? startHistoryId;

  const histories: { messagesAdded?: { message: { id: string } }[] }[] =
    historyData.history ?? [];

  // Collect all new message IDs
  const messageIds = new Set<string>();
  for (const h of histories) {
    for (const added of h.messagesAdded ?? []) {
      messageIds.add(added.message.id);
    }
  }

  if (messageIds.size === 0) {
    return { messages: [], newHistoryId };
  }

  // Fetch full metadata for each new message
  const messages: GmailMessage[] = [];
  const ids = Array.from(messageIds);
  const batchSize = 10;
  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(async (id) => {
        const msgUrl = `${GMAIL_BASE}/messages/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Date`;
        const msgRes = await fetch(msgUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!msgRes.ok) return null;
        return msgRes.json();
      })
    );

    for (const msg of batchResults) {
      if (msg) {
        messages.push(parseGmailMessage(msg));
      }
    }
  }

  return { messages, newHistoryId };
}
