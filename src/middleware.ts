import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// How long to trust a successful auth refresh before re-running it. Supabase
// access tokens last ~1 hour, so 5 minutes is a safe ceiling — worst case the
// refresh runs 12×/hour instead of every page navigation. Saves 200–400ms
// of Supabase round-trip latency on every cached request.
const AUTH_FRESHNESS_COOKIE = "cc-auth-fresh";
const AUTH_FRESHNESS_TTL_S = 5 * 60;

export async function middleware(request: NextRequest) {
  const isAuthPage = request.nextUrl.pathname.startsWith("/login");

  // Public routes — webhooks, processing endpoints, PIN check
  const isPublicApi =
    request.nextUrl.pathname.startsWith("/api/digest/") ||
    request.nextUrl.pathname.startsWith("/api/webhooks/") ||
    request.nextUrl.pathname.startsWith("/api/cron/") ||
    request.nextUrl.pathname.startsWith("/api/auth/") ||
    request.nextUrl.pathname.startsWith("/api/health");

  const hasPin = request.cookies.get("cc-auth")?.value === "authenticated";
  const authIsFresh =
    request.cookies.get(AUTH_FRESHNESS_COOKIE)?.value === "1";

  // PIN gate
  if (!hasPin && !isAuthPage && !isPublicApi) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  if (hasPin && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // Skip the Supabase round-trip on most requests:
  //   - public APIs / login page never need it
  //   - authenticated requests with a fresh auth cookie skip it too
  // The /api/auth/pin route stamps the freshness cookie after a successful
  // sign-in, so the first navigation after PIN entry also skips this block.
  if (!hasPin || isAuthPage || isPublicApi || authIsFresh) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Touch the session so @supabase/ssr refreshes cookies if needed.
  const { data: { user } } = await supabase.auth.getUser();

  // If PIN is valid but Supabase session is missing (expired refresh token,
  // first load after migration, etc.), silently re-sign-in so RLS unlocks.
  if (!user) {
    const email = process.env.SUPABASE_USER_EMAIL;
    const password = process.env.SUPABASE_USER_PASSWORD;
    if (email && password) {
      await supabase.auth.signInWithPassword({ email, password });
    }
  }

  // Stamp the freshness cookie so subsequent requests skip this block until
  // it expires. NextResponse.next() above may have been overwritten by the
  // Supabase setAll callback — re-attach the cookie to whatever `response`
  // currently points to.
  response.cookies.set(AUTH_FRESHNESS_COOKIE, "1", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: AUTH_FRESHNESS_TTL_S,
  });

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons|logos|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
