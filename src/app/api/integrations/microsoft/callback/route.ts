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

    // Handle OAuth errors from Microsoft
    if (error) {
      const errorDescription = searchParams.get("error_description") || error;
      console.error("Microsoft OAuth error:", errorDescription);
      return NextResponse.redirect(
        new URL(`/settings?error=microsoft_${error}`, request.url)
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL("/settings?error=microsoft_missing_params", request.url)
      );
    }

    // Validate CSRF state
    const cookieStore = await cookies();
    const storedState = cookieStore.get("microsoft_oauth_state")?.value;

    if (!storedState || storedState !== state) {
      return NextResponse.redirect(
        new URL("/settings?error=microsoft_state_mismatch", request.url)
      );
    }

    // Clear the state cookie
    cookieStore.delete("microsoft_oauth_state");

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
    const tokenResponse = await fetch(
      "https://login.microsoftonline.com/common/oauth2/v2.0/token",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: process.env.MICROSOFT_CLIENT_ID!,
          client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
          redirect_uri: process.env.MICROSOFT_REDIRECT_URI!,
          grant_type: "authorization_code",
        }),
      }
    );

    if (!tokenResponse.ok) {
      const tokenError = await tokenResponse.text();
      console.error("Microsoft token exchange failed:", tokenError);
      return NextResponse.redirect(
        new URL("/settings?error=microsoft_token_exchange", request.url)
      );
    }

    const tokens = await tokenResponse.json();

    // Fetch user profile to get email
    const profileResponse = await fetch(
      "https://graph.microsoft.com/v1.0/me",
      {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      }
    );

    if (!profileResponse.ok) {
      console.error(
        "Microsoft profile fetch failed:",
        await profileResponse.text()
      );
      return NextResponse.redirect(
        new URL("/settings?error=microsoft_profile_fetch", request.url)
      );
    }

    const profile = await profileResponse.json();
    const accountEmail =
      profile.mail || profile.userPrincipalName || profile.email;

    // Upsert into email_connections using service role client
    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error: upsertError } = await adminClient
      .from("email_connections")
      .upsert(
        {
          user_id: user.id,
          provider: "microsoft",
          account_email: accountEmail,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_expires_at: new Date(
            Date.now() + tokens.expires_in * 1000
          ).toISOString(),
          scopes: ["Mail.Read", "User.Read", "offline_access"],
        },
        { onConflict: "user_id,provider" }
      );

    if (upsertError) {
      console.error("Microsoft connection upsert failed:", upsertError);
      return NextResponse.redirect(
        new URL("/settings?error=microsoft_save_failed", request.url)
      );
    }

    return NextResponse.redirect(
      new URL("/settings?connected=microsoft", request.url)
    );
  } catch (error) {
    console.error("Microsoft OAuth callback error:", error);
    return NextResponse.redirect(
      new URL("/settings?error=microsoft_callback_failed", request.url)
    );
  }
}
