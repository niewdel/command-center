import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Accounts allowed into the app. The core operators are ALWAYS allowed —
// hardcoded here so a stale/single-value env var can never lock the team out.
// ALLOWED_LOGIN_EMAILS (comma-separated; legacy ALLOWED_LOGIN_EMAIL honored)
// only ADDS further emails on top. Anyone else — even a self-registered anon
// session — is rejected here, and RLS would show them nothing regardless.
const CORE_EMAILS = ["justin@niewdel.com", "dillon@niewdel.com"];
const ALLOWED_EMAILS = new Set(
  [
    ...CORE_EMAILS,
    ...(
      process.env.ALLOWED_LOGIN_EMAILS ||
      process.env.ALLOWED_LOGIN_EMAIL ||
      ""
    ).split(","),
  ]
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
);

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Public auth pages — sign in, request reset, set a new password.
  const isAuthPage = path === "/login" || path.startsWith("/login/");

  // Self-authenticating platform endpoints. Cron fires these over loopback
  // with CRON_SECRET; webhooks/digest verify their own signatures/secrets.
  // The app gate must not block them or the SEO pipeline stops running.
  // /api/portal/* verifies the client's view token itself (scoped to that
  // client's id) — same trust model as the digest/webhooks/cron endpoints,
  // just keyed by token instead of a shared secret.
  const isPublicApi =
    path.startsWith("/api/digest/") ||
    path.startsWith("/api/webhooks/") ||
    path.startsWith("/api/cron/") ||
    path.startsWith("/api/portal/") ||
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

  // Token-protected, client-facing customer portal. Same magic-link model
  // as the report view above: /portal/[id]?token=… — no login, no expiry
  // until the signing secret rotates. The portal page re-verifies the
  // token itself; this only decides whether the request needs a session.
  const portalPathMatches = /^\/portal\/[^/]+\/?$/.test(path);
  const isPortalPublic = portalPathMatches && hasToken;

  const isPublicClientSurface = isReportPublic || isPortalPublic;

  // Strip ALL operator chrome for the token-gated client report/portal so
  // the recipient sees only their own scoped view.
  const propagatedHeaders = new Headers(request.headers);
  if (isPublicClientSurface) propagatedHeaders.set("x-cc-bare-shell", "1");

  // Public routes pass straight through, no session required.
  if (isAuthPage || isPublicApi || isPublicClientSurface) {
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

  if (!user || !ALLOWED_EMAILS.has((user.email ?? "").toLowerCase())) {
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
