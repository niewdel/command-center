// Gmail API send wrapper. Sends from the authenticated user's actual Gmail
// or Workspace account (e.g. justin.ledwein@niewdel.com), using their own
// SPF/DKIM/DMARC chain. Replaces Resend for our transactional volume.
//
// Requires the GMAIL_SEND_SCOPE on the user's google_oauth_connections row.
// If the scope isn't present (older connections), throws GmailScopeMissingError
// so the caller can fall back to Resend cleanly.

import { getValidAccessToken, getConnection, GMAIL_SEND_SCOPE } from "./oauth";

const GMAIL_SEND_URL =
  "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";

export class GmailScopeMissingError extends Error {
  constructor() {
    super(
      "Gmail send scope not granted. Re-authorize Google to grant gmail.send."
    );
    this.name = "GmailScopeMissingError";
  }
}

interface SendInput {
  user_id: string;       // Supabase user_id whose google connection we use
  to: string | string[];
  subject: string;
  html: string;
  reply_to?: string;
  from_name?: string;    // optional display name (e.g. "Niewdel")
}

// Encode a UTF-8 string to RFC 2047 quoted-printable for use in headers
// like Subject. Gmail accepts UTF-8 in raw MIME but headers should be
// encoded properly. We use the simpler base64 encoding scheme.
function encodeHeader(s: string): string {
  // ASCII-only? Skip encoding to keep headers readable.
  if (/^[\x20-\x7E]*$/.test(s)) return s;
  const b64 = Buffer.from(s, "utf8").toString("base64");
  return `=?UTF-8?B?${b64}?=`;
}

function buildMime(input: {
  from: string;
  to: string[];
  subject: string;
  html: string;
  reply_to?: string;
  from_name?: string;
}): string {
  const fromHeader = input.from_name
    ? `${encodeHeader(input.from_name)} <${input.from}>`
    : input.from;
  const lines = [
    `From: ${fromHeader}`,
    `To: ${input.to.join(", ")}`,
    `Subject: ${encodeHeader(input.subject)}`,
    "MIME-Version: 1.0",
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: 7bit",
  ];
  if (input.reply_to) lines.push(`Reply-To: ${input.reply_to}`);
  lines.push("", input.html);
  return lines.join("\r\n");
}

function base64UrlEncode(s: string): string {
  return Buffer.from(s, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function isGmailSendGranted(userId: string): Promise<boolean> {
  const conn = await getConnection(userId);
  if (!conn) return false;
  return conn.scopes.includes(GMAIL_SEND_SCOPE);
}

export async function sendGmail(input: SendInput): Promise<{ id: string }> {
  const granted = await isGmailSendGranted(input.user_id);
  if (!granted) throw new GmailScopeMissingError();

  const conn = await getConnection(input.user_id);
  if (!conn) throw new GmailScopeMissingError();

  const token = await getValidAccessToken(input.user_id);
  const to = Array.isArray(input.to) ? input.to : [input.to];

  const mime = buildMime({
    from: conn.google_email,    // sender = the authenticated google account
    to,
    subject: input.subject,
    html: input.html,
    reply_to: input.reply_to,
    from_name: input.from_name,
  });

  const raw = base64UrlEncode(mime);

  const res = await fetch(GMAIL_SEND_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ raw }),
    signal: AbortSignal.timeout(20_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Gmail send ${res.status}: ${text.slice(0, 300)}`);
  }
  const data = (await res.json()) as { id?: string };
  if (!data.id) throw new Error("Gmail send returned no message id");
  return { id: data.id };
}
