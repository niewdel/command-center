export type OutlookMessage = {
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

const GRAPH_BASE = "https://graph.microsoft.com/v1.0/me";

type GraphRecipient = {
  emailAddress: { name?: string; address: string };
};

function mapGraphMessage(msg: Record<string, unknown>): OutlookMessage {
  const from = msg.from as GraphRecipient | undefined;
  const toRecipients = (msg.toRecipients as GraphRecipient[]) ?? [];
  const ccRecipients = (msg.ccRecipients as GraphRecipient[]) ?? [];

  const recipients = [
    ...toRecipients.map((r) => ({
      email: r.emailAddress.address,
      name: r.emailAddress.name || undefined,
      type: "to" as const,
    })),
    ...ccRecipients.map((r) => ({
      email: r.emailAddress.address,
      name: r.emailAddress.name || undefined,
      type: "cc" as const,
    })),
  ];

  return {
    id: msg.id as string,
    threadId: (msg.conversationId as string) ?? (msg.id as string),
    subject: (msg.subject as string) ?? "",
    snippet: (msg.bodyPreview as string) ?? "",
    senderName: from?.emailAddress.name ?? "",
    senderEmail: from?.emailAddress.address ?? "",
    recipients,
    receivedAt: (msg.receivedDateTime as string) ?? new Date().toISOString(),
    isRead: (msg.isRead as boolean) ?? false,
    hasAttachments: (msg.hasAttachments as boolean) ?? false,
    labels: (msg.categories as string[]) ?? [],
  };
}

export async function fetchOutlookMessages(
  accessToken: string,
  maxResults: number = 50
): Promise<OutlookMessage[]> {
  const url = `${GRAPH_BASE}/messages?$top=${maxResults}&$orderby=receivedDateTime desc&$select=id,subject,bodyPreview,from,toRecipients,ccRecipients,receivedDateTime,isRead,hasAttachments,conversationId,categories`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`Outlook messages failed (${res.status}): ${await res.text()}`);
  }

  const data = await res.json();
  const messages: Record<string, unknown>[] = data.value ?? [];

  return messages.map(mapGraphMessage);
}

export async function fetchOutlookDelta(
  accessToken: string,
  deltaLink: string
): Promise<{ messages: OutlookMessage[]; newDeltaLink: string }> {
  const allMessages: OutlookMessage[] = [];
  let nextLink: string | null = deltaLink;
  let newDeltaLink = deltaLink;

  while (nextLink) {
    const res: Response = await fetch(nextLink, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      throw new Error(`Outlook delta failed (${res.status}): ${await res.text()}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await res.json();
    const messages: Record<string, unknown>[] = data.value ?? [];
    allMessages.push(...messages.map(mapGraphMessage));

    nextLink = data["@odata.nextLink"] ?? null;
    if (data["@odata.deltaLink"]) {
      newDeltaLink = data["@odata.deltaLink"];
    }
  }

  return { messages: allMessages, newDeltaLink };
}
