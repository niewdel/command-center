import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase-server";

export { ACTIVE_WORKSPACE_COOKIE } from "./constants";
import { ACTIVE_WORKSPACE_COOKIE } from "./constants";

export type ActiveWorkspace = {
  id: string;
  slug: string;
  name: string;
  kind: "internal" | "client" | "demo";
};

// The user-scoped Supabase client: cookie-authenticated, so every query runs
// as the logged-in user and RLS applies. This is the ONLY client authenticated
// CRM routes may use; the service-role client is reserved for token-gated
// public surfaces and webhooks (see middleware notes).
export async function getUserScopedClient() {
  return createClient();
}

// Gate for agency-internal tools (leads, SEO, audits, issues, uploads, AI
// commands). These tools span workspaces by design, so membership isn't
// enough — the caller must be in agency_admins. Returns the caller's user id
// on success, null otherwise (fail closed on any error).
export async function requireAgencyAdmin(): Promise<{ userId: string } | null> {
  const supabase = await getUserScopedClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase.rpc("is_agency_admin", {
    uid: user.id,
  });
  if (error) {
    console.error("[tenancy] is_agency_admin check failed; failing closed:", error.message);
    return null;
  }
  return data === true ? { userId: user.id } : null;
}

// Resolve the active tenant. The workspaces SELECT is already RLS-filtered to
// the user's memberships, so an invalid/foreign cookie simply misses the list
// and falls through to the default — no separate membership check needed.
export async function resolveActiveWorkspace(): Promise<ActiveWorkspace | null> {
  const supabase = await getUserScopedClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: workspaces, error } = await supabase
    .from("workspaces")
    .select("id, slug, name, kind")
    .order("position", { ascending: true });
  // Fails closed (null → routes 401), but leave a trace: a DB blip here
  // reads as "no memberships" to the caller and would otherwise be silent.
  if (error) {
    console.error("[tenancy] workspaces query failed; failing closed:", error.message);
    return null;
  }
  if (!workspaces || workspaces.length === 0) return null;

  const cookieStore = await cookies();
  const requested = cookieStore.get(ACTIVE_WORKSPACE_COOKIE)?.value;
  const fromCookie = requested
    ? workspaces.find((w) => w.id === requested)
    : undefined;

  return (
    (fromCookie as ActiveWorkspace | undefined) ??
    (workspaces.find((w) => w.slug === "niewdel") as ActiveWorkspace | undefined) ??
    (workspaces[0] as ActiveWorkspace)
  );
}
