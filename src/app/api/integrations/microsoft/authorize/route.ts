import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase-server";
import crypto from "crypto";

export async function GET(request: NextRequest) {
  try {
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

    // Generate CSRF state param
    const state = crypto.randomBytes(32).toString("hex");

    // Store state in cookie for validation on callback
    const cookieStore = await cookies();
    cookieStore.set("microsoft_oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 10, // 10 minutes
      path: "/",
    });

    // Build Microsoft OAuth URL
    const params = new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID!,
      redirect_uri: process.env.MICROSOFT_REDIRECT_URI!,
      response_type: "code",
      scope: "Mail.Read User.Read offline_access",
      state,
      response_mode: "query",
    });

    const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;

    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error("Microsoft OAuth authorize error:", error);
    return NextResponse.redirect(
      new URL("/settings?error=microsoft_auth_failed", request.url)
    );
  }
}
