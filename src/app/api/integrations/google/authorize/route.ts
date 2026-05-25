import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase-server";
import {
  buildAuthorizeUrl,
  generateState,
  ANALYTICS_READONLY_SCOPE,
  GMAIL_SEND_SCOPE,
  ADWORDS_SCOPE,
} from "@/lib/google/oauth";

export const dynamic = "force-dynamic";

// Kicks off the Google OAuth flow. Generates a CSRF state token, stashes
// it in an httpOnly cookie, and redirects the user to Google's consent
// screen for the GA4 read-only scope.
export async function GET(_request: NextRequest) {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: "Not authenticated. Sign in first." },
      { status: 401 }
    );
  }

  const state = generateState();
  const cookieStore = await cookies();
  cookieStore.set("google_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600, // 10 minutes — long enough for the user to consent
  });

  const url = buildAuthorizeUrl({
    scopes: [
      ANALYTICS_READONLY_SCOPE,
      GMAIL_SEND_SCOPE,
      ADWORDS_SCOPE,
      "openid",
      "email",
    ],
    state,
  });
  return NextResponse.redirect(url);
}
