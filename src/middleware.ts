import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Only this account may enter the app. Even if someone self-registers through
// the public anon key, their session is rejected here — and RLS would show
// them nothing regardless. Override per-environment with ALLOWED_LOGIN_EMAIL.
const ALLOWED_EMAIL = (
  process.env.ALLOWED_LOGIN_EMAIL || "justin@niewdel.com"
).toLowerCase();

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Public auth pages — sign in, request reset, set a new password.
  const isAuthPage = path === "/login" || path.startsWith("/login/");

  // Self-authenticating platform endpoints. Cron fires these over loopback
  // with CRON_SECRET; webhooks/digest verify their own signatures/secrets.
  // The app gate must not block them or the SEO pipeline stops running.
  const isPublicApi =
    path.startsWith("/api/digest/") ||
    path.startsWith("/api/webhooks/") ||
    path.startsWith("/api/cron/") ||
    path.startsWith("/api/health");

  // Token-protected, client-facing SEO report (magic link + Playwright print).
  // Stays reachable without a login so clients can view their own report.
  const reportPathMatches = /^\/seo\/clients\/[^/]+\/report\/?$/.test(path);
  const hasToken = !!request.nextUrl.searchParams.get("token");
  const isReportPrint =
    reportPathMatches &&
    request.nextUrl.searchParams.get("print") === "1" &&
    hasToken;
  const isReportView =
    reportPathMatches &&
    request.nextUrl.searchParams.get("view") === "1" &&
    hasToken;
  const isReportPublic = isReportPrint || isReportView;

  // Strip ALL operator chrome for the token-gated client report so the
  // recipient sees only their own scoped report.
  const propagatedHeaders = new Headers(request.headers);
  if (isReportPublic) propagatedHeaders.set("x-cc-bare-shell", "1");

  // Public routes pass straight through, no session required.
  if (isAuthPage || isPublicApi || isReportPublic) {
    return NextResponse.next({ request: { headers: propagatedHeaders } });
  }

  // Everything else requires the one allow-listed Supabase session.
  let response = NextResponse.next({ request: { headers: propagatedHeaders } });
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
          response = NextResponse.next({ request: { headers: propagatedHeaders } });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getUser() validates the JWT with Supabase — authoritative, not just a
  // cookie read. Cheap enough for a single-operator app.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || (user.email ?? "").toLowerCase() !== ALLOWED_EMAIL) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons|logos|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
