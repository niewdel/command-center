import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getConnection } from "@/lib/google/oauth";

export const dynamic = "force-dynamic";

// Lightweight status endpoint for the UI to render the right state
// (Connected as ... vs Connect button).
export async function GET(_request: NextRequest) {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ connected: false, error: "Not authenticated" }, { status: 401 });
  }
  const conn = await getConnection(user.id);
  if (!conn) {
    return NextResponse.json({ connected: false });
  }
  return NextResponse.json({
    connected: true,
    google_email: conn.google_email,
    scopes: conn.scopes,
  });
}
