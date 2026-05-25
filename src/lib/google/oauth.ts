// Google OAuth 2.0 helpers — token exchange, refresh, and load.
// All Google integrations (GA4 today, possibly Search Console later) share
// the single google_oauth_connections row per user, so adding a new scope
// just means re-running the authorize flow with that scope appended.

import crypto from "node:crypto";
import { createClient as createServiceClient, SupabaseClient } from "@supabase/supabase-js";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

// Skew buffer: refresh access token if it expires within the next 60 seconds.
const REFRESH_SKEW_MS = 60_000;

export const ANALYTICS_READONLY_SCOPE =
  "https://www.googleapis.com/auth/analytics.readonly";

// Lets us send transactional email (monthly reports, weekly digests) from
// the user's own Gmail/Workspace account. Replaces Resend for our use case
// — emails come from the user's real address with no domain verification
// needed since Workspace handles SPF/DKIM/DMARC.
export const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";

// Read campaign performance from accounts linked under the operator's
// MCC. Used to pull Google Ads metrics into the monthly SEO report.
// Requires GOOGLE_ADS_DEVELOPER_TOKEN + GOOGLE_ADS_LOGIN_CUSTOMER_ID
// env vars set on the server.
export const ADWORDS_SCOPE = "https://www.googleapis.com/auth/adwords";

// ----- Service-role Supabase client (bypasses RLS for token writes) -----
let _service: SupabaseClient | null = null;
function getService(): SupabaseClient {
  if (_service) return _service;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  _service = createServiceClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _service;
}

function getRedirectUri(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (!base) {
    throw new Error("NEXT_PUBLIC_APP_URL not set — required for OAuth redirect");
  }
  return `${base}/api/integrations/google/callback`;
}

function getClientCredentials(): { id: string; secret: string } {
  const id = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const secret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!id || !secret) {
    throw new Error(
      "GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET not set"
    );
  }
  return { id, secret };
}

// ----- Authorize URL builder -----

export function buildAuthorizeUrl(opts: {
  scopes: string[];
  state: string;
}): string {
  const { id } = getClientCredentials();
  const params = new URLSearchParams({
    client_id: id,
    redirect_uri: getRedirectUri(),
    response_type: "code",
    scope: opts.scopes.join(" "),
    access_type: "offline",       // request refresh_token
    include_granted_scopes: "true",
    prompt: "consent",            // force consent so we always get a refresh_token
    state: opts.state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export function generateState(): string {
  return crypto.randomBytes(24).toString("base64url");
}

// ----- Token exchange + refresh -----

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

export async function exchangeCodeForTokens(code: string): Promise<TokenResponse> {
  const { id, secret } = getClientCredentials();
  const body = new URLSearchParams({
    client_id: id,
    client_secret: secret,
    code,
    grant_type: "authorization_code",
    redirect_uri: getRedirectUri(),
  });
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Google token exchange ${res.status}: ${text.slice(0, 300)}`);
  }
  return (await res.json()) as TokenResponse;
}

export async function refreshAccessToken(
  refreshToken: string
): Promise<TokenResponse> {
  const { id, secret } = getClientCredentials();
  const body = new URLSearchParams({
    client_id: id,
    client_secret: secret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Google token refresh ${res.status}: ${text.slice(0, 300)}`);
  }
  return (await res.json()) as TokenResponse;
}

// ----- userinfo fetch (used post-callback to get the email) -----

export async function fetchUserInfo(
  accessToken: string
): Promise<{ email: string }> {
  const res = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    throw new Error(`Google userinfo ${res.status}`);
  }
  const data = (await res.json()) as { email?: string };
  if (!data.email) throw new Error("Google userinfo returned no email");
  return { email: data.email };
}

// ----- DB persistence -----

export interface GoogleConnection {
  id: string;
  user_id: string;
  google_email: string;
  scopes: string[];
  access_token: string;
  refresh_token: string;
  expires_at: string;
}

export async function saveConnection(opts: {
  user_id: string;
  google_email: string;
  scopes: string[];
  access_token: string;
  refresh_token: string;
  expires_in: number;
}): Promise<void> {
  const sb = getService();
  const expiresAt = new Date(Date.now() + opts.expires_in * 1000).toISOString();
  const { error } = await sb
    .from("google_oauth_connections")
    .upsert(
      {
        user_id: opts.user_id,
        google_email: opts.google_email,
        scopes: opts.scopes,
        access_token: opts.access_token,
        refresh_token: opts.refresh_token,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
  if (error) throw new Error(`Failed to save google connection: ${error.message}`);
}

export async function getConnection(
  userId: string
): Promise<GoogleConnection | null> {
  const sb = getService();
  const { data, error } = await sb
    .from("google_oauth_connections")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load google connection: ${error.message}`);
  return (data as GoogleConnection | null) ?? null;
}

export async function deleteConnection(userId: string): Promise<void> {
  const sb = getService();
  const { error } = await sb
    .from("google_oauth_connections")
    .delete()
    .eq("user_id", userId);
  if (error) throw new Error(`Failed to delete google connection: ${error.message}`);
}

// Returns a valid access token, refreshing if it's about to expire.
// Persists the new access_token + expires_at back to the row.
export async function getValidAccessToken(userId: string): Promise<string> {
  const conn = await getConnection(userId);
  if (!conn) {
    throw new Error("No Google connection — run the authorize flow first");
  }
  const expiresAt = new Date(conn.expires_at).getTime();
  if (expiresAt - Date.now() > REFRESH_SKEW_MS) {
    return conn.access_token;
  }
  // Token expired or close to it — refresh.
  const refreshed = await refreshAccessToken(conn.refresh_token);
  const newExpiresAt = new Date(
    Date.now() + refreshed.expires_in * 1000
  ).toISOString();
  const sb = getService();
  await sb
    .from("google_oauth_connections")
    .update({
      access_token: refreshed.access_token,
      expires_at: newExpiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
  return refreshed.access_token;
}
