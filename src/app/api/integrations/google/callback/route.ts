import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase-server";
import {
  exchangeCodeForTokens,
  fetchUserInfo,
  saveConnection,
} from "@/lib/google/oauth";

export const dynamic = "force-dynamic";

// Google redirects here after consent. We verify the state cookie matches
// the state param (CSRF guard), exchange the code for tokens, fetch the
// user's email, persist the connection, and bounce them back to settings
// with a status flag.
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const stateParam = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");
  const settingsBase =
    (process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "") + "/settings";

  if (errorParam) {
    return NextResponse.redirect(
      `${settingsBase}?google=error&msg=${encodeURIComponent(errorParam)}`
    );
  }

  if (!code || !stateParam) {
    return NextResponse.redirect(`${settingsBase}?google=error&msg=missing_params`);
  }

  const cookieStore = await cookies();
  const stateCookie = cookieStore.get("google_oauth_state")?.value;
  if (!stateCookie || stateCookie !== stateParam) {
    return NextResponse.redirect(`${settingsBase}?google=error&msg=state_mismatch`);
  }
  // One-time use: clear the cookie immediately.
  cookieStore.delete("google_oauth_state");

  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${settingsBase}?google=error&msg=not_authenticated`);
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    if (!tokens.refresh_token) {
      // This means Google didn't return one — usually because the user
      // already authorized this app and didn't see a fresh consent screen.
      // We force prompt=consent in buildAuthorizeUrl precisely to avoid
      // this, but if it still happens, the user needs to revoke at
      // https://myaccount.google.com/permissions and retry.
      return NextResponse.redirect(
        `${settingsBase}?google=error&msg=no_refresh_token`
      );
    }
    const info = await fetchUserInfo(tokens.access_token);
    await saveConnection({
      user_id: user.id,
      google_email: info.email,
      scopes: tokens.scope.split(" ").filter(Boolean),
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_in: tokens.expires_in,
    });
    return NextResponse.redirect(`${settingsBase}?google=connected`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[google/callback] failed:", msg);
    return NextResponse.redirect(
      `${settingsBase}?google=error&msg=${encodeURIComponent(msg.slice(0, 100))}`
    );
  }
}
