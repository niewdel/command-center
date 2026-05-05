import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

const APP_PIN = process.env.APP_PIN || "2114";

export async function POST(request: NextRequest) {
  const { pin } = await request.json();

  if (pin !== APP_PIN) {
    return NextResponse.json({ error: "Invalid PIN" }, { status: 401 });
  }

  const response = NextResponse.json({ success: true });
  // SameSite=lax (not strict) so the PIN cookie survives top-level cross-site
  // GET navigations — required for OAuth callback flows (Google redirects
  // back to /api/integrations/google/callback and the cookie must be sent).
  // Strict would mean middleware sees no auth cookie on the OAuth return and
  // bounces the user to /login, killing the flow. Lax is still secure: the
  // cookie is blocked from embeds, fetches, and POST navigations — only
  // user-initiated top-level GETs receive it.
  response.cookies.set("cc-auth", "authenticated", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  response.cookies.set("cc-auth-fresh", "1", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 5 * 60,
  });

  // Also establish a Supabase Auth session so RLS policies scoped to auth.uid()
  // can read data. The server client writes sb-* cookies onto `response`.
  const email = process.env.SUPABASE_USER_EMAIL;
  const password = process.env.SUPABASE_USER_PASSWORD;

  if (email && password) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      console.error("Supabase sign-in failed during PIN login:", error.message);
      // Don't block the login — PIN cookie is still set. RLS just won't unlock
      // for this session. Caller will see an empty app until env vars are fixed.
    }
  }

  return response;
}
