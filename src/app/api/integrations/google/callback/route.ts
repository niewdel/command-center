import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase-server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    // Handle OAuth errors from Google
    if (error) {
      console.error("Google OAuth error:", error);
      return NextResponse.redirect(
        new URL(`/settings?error=google_${error}`, request.url)
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL("/settings?error=google_missing_params", request.url)
      );
    }

    // Validate CSRF state
    const cookieStore = await cookies();
    const storedState = cookieStore.get("google_oauth_state")?.value;

    if (!storedState || storedState !== state) {
      return NextResponse.redirect(
        new URL("/settings?error=google_state_mismatch", request.url)
      );
    }

    // Clear the state cookie
    cookieStore.delete("google_oauth_state");

    // Verify user is authenticated
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.redirect(
        new URL("/login", request.url)
      );
    }

    // Exchange authorization code for tokens
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      const tokenError = await tokenResponse.text();
      console.error("Google token exchange failed:", tokenError);
      return NextResponse.redirect(
        new URL("/settings?error=google_token_exchange", request.url)
      );
    }

    const tokens = await tokenResponse.json();

    // Fetch user profile to get email
    const profileResponse = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      }
    );

    if (!profileResponse.ok) {
      console.error("Google profile fetch failed:", await profileResponse.text());
      return NextResponse.redirect(
        new URL("/settings?error=google_profile_fetch", request.url)
      );
    }

    const profile = await profileResponse.json();

    // Upsert into email_connections using service role client
    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const scopes = [
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile",
    ];

    const { error: upsertError } = await adminClient
      .from("email_connections")
      .upsert(
        {
          user_id: user.id,
          provider: "google",
          account_email: profile.email,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_expires_at: new Date(
            Date.now() + tokens.expires_in * 1000
          ).toISOString(),
          scopes: scopes,
        },
        { onConflict: "user_id,provider" }
      );

    if (upsertError) {
      console.error("Google connection upsert failed:", upsertError);
      return NextResponse.redirect(
        new URL("/settings?error=google_save_failed", request.url)
      );
    }

    return NextResponse.redirect(
      new URL("/settings?connected=google", request.url)
    );
  } catch (error) {
    console.error("Google OAuth callback error:", error);
    return NextResponse.redirect(
      new URL("/settings?error=google_callback_failed", request.url)
    );
  }
}
