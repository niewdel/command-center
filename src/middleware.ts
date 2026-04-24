import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

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

  // Supabase session refresh + auto-recovery.
  // Only runs for authenticated page requests (skip public APIs + login page).
  if (!hasPin || isAuthPage || isPublicApi) {
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

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons|logos|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
