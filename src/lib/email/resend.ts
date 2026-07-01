// Minimal Resend client — calls the REST API directly so we don't pull in
// the resend npm package. Throws if RESEND_API_KEY isn't set.
//
// FROM_ADDRESS comes from SEO_DIGEST_FROM (or RESEND_FROM as fallback).
// Default 'onboarding@resend.dev' works out of the box on Resend's sandbox
// without domain verification — fine for dev. Swap to admin@niewdel.com once
// the Workspace MX records resolve.

interface SendEmailInput {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
}

interface ResendResponse {
  id?: string;
  message?: string;
  name?: string;
}

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export class EmailNotConfiguredError extends Error {
  constructor() {
    super("RESEND_API_KEY is not set");
    this.name = "EmailNotConfiguredError";
  }
}

function defaultFrom(): string {
  return (
    process.env.SEO_DIGEST_FROM ||
    process.env.RESEND_FROM ||
    "onboarding@resend.dev"
  );
}

export async function sendEmail(input: SendEmailInput): Promise<{ id: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new EmailNotConfiguredError();

  const body = {
    from: input.from ?? defaultFrom(),
    to: Array.isArray(input.to) ? input.to : [input.to],
    subject: input.subject,
    html: input.html,
    ...(input.cc
      ? { cc: Array.isArray(input.cc) ? input.cc : [input.cc] }
      : {}),
    ...(input.bcc
      ? { bcc: Array.isArray(input.bcc) ? input.bcc : [input.bcc] }
      : {}),
    ...(input.replyTo ? { reply_to: input.replyTo } : {}),
  };

  const res = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });

  const data = (await res.json().catch(() => ({}))) as ResendResponse;

  if (!res.ok) {
    throw new Error(
      `Resend ${res.status}: ${data.message ?? data.name ?? "unknown error"}`
    );
  }
  if (!data.id) {
    throw new Error("Resend returned no message id");
  }
  return { id: data.id };
}

export function isEmailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}
