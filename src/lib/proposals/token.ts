// src/lib/proposals/token.ts
//
// HMAC-signed tokens for the token-gated client proposal view + sign flow.
// Mirrors the view-token half of src/lib/seo/report-print-token.ts
// (signViewToken/verifyViewToken): no time bucket, never expires on its
// own — revocation = rotate the env secret.
//
// Env key is PROPOSAL_VIEW_SECRET. If unset, falls back to
// SEO_REPORT_PRINT_SECRET so this works in prod today without requiring a
// new secret to be provisioned before the feature ships; set
// PROPOSAL_VIEW_SECRET explicitly once it's convenient to rotate proposal
// links independently of SEO report links.

import { createHmac, timingSafeEqual } from "node:crypto";

const ENV_KEY = "PROPOSAL_VIEW_SECRET";
const FALLBACK_ENV_KEY = "SEO_REPORT_PRINT_SECRET";

function getSecret(): string {
  const s = process.env[ENV_KEY] || process.env[FALLBACK_ENV_KEY];
  if (!s) throw new Error(`Missing ${ENV_KEY} (and no ${FALLBACK_ENV_KEY} fallback)`);
  return s;
}

export function signProposalToken(proposalId: string): string {
  const payload = `${proposalId}|proposal`;
  return createHmac("sha256", getSecret()).update(payload).digest("hex");
}

export function verifyProposalToken(proposalId: string, token: string): boolean {
  if (typeof token !== "string" || token.length !== 64) return false;
  const expected = signProposalToken(proposalId);
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(token, "hex");
  // Defensive: timingSafeEqual throws on length mismatch. The earlier
  // length-64 check makes this unreachable in practice, but cheap insurance.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
