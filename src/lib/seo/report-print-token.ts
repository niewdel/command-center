// src/lib/seo/report-print-token.ts
//
// HMAC-signed tokens for the print version of a client report. The middleware
// allows /seo/clients/[id]/report through unauthenticated when ?print=1 and
// a valid token are both present; the route then re-validates the token and
// renders the report. Tokens are scoped to (client_id, range, day_bucket)
// so they expire after 24h naturally.

import { createHmac, timingSafeEqual } from "node:crypto";

const ENV_KEY = "SEO_REPORT_PRINT_SECRET";

function getSecret(): string {
  const s = process.env[ENV_KEY];
  if (!s) throw new Error(`Missing ${ENV_KEY}`);
  return s;
}

function dayBucket(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD UTC
}

export function signPrintToken(
  clientId: string,
  range: string,
  d: Date = new Date()
): string {
  const payload = `${clientId}|${range}|${dayBucket(d)}`;
  return createHmac("sha256", getSecret()).update(payload).digest("hex");
}

export function verifyPrintToken(
  clientId: string,
  range: string,
  token: string,
  d: Date = new Date()
): boolean {
  if (typeof token !== "string" || token.length !== 64) return false;
  const expected = signPrintToken(clientId, range, d);
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(token, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
