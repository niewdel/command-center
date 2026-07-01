import { NextResponse } from "next/server";
import { ACTIVE_WORKSPACE_COOKIE, getUserScopedClient } from "@/lib/tenancy";

export async function POST(request: Request) {
  const supabase = await getUserScopedClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let workspaceId: unknown;
  try {
    ({ workspaceId } = await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  if (typeof workspaceId !== "string" || !workspaceId) {
    return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  }

  // RLS-filtered read doubles as the membership check.
  const { data: ws } = await supabase
    .from("workspaces")
    .select("id")
    .eq("id", workspaceId)
    .maybeSingle();
  if (!ws) return NextResponse.json({ error: "Not a member" }, { status: 403 });

  const res = NextResponse.json({ ok: true });
  // Not httpOnly: the value is a UI hint the switcher reads via document.cookie
  // to know which workspace is active; the server re-validates membership on
  // every request via resolveActiveWorkspace's RLS-filtered select, so a
  // tampered/foreign cookie value can't grant access to data the user
  // doesn't already have.
  res.cookies.set(ACTIVE_WORKSPACE_COOKIE, workspaceId, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}
