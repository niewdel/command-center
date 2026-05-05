import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { listProperties } from "@/lib/google/ga4";
import { getConnection } from "@/lib/google/oauth";

export const dynamic = "force-dynamic";

// GET /api/integrations/google/properties
// Returns all GA4 properties the connected Google account can access,
// flattened with account name for the property picker UI.
export async function GET(_request: NextRequest) {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const conn = await getConnection(user.id);
  if (!conn) {
    return NextResponse.json(
      { error: "No Google connection. Connect Google Analytics first." },
      { status: 400 }
    );
  }

  try {
    const properties = await listProperties(user.id);
    return NextResponse.json({
      connection: { google_email: conn.google_email },
      properties,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[google/properties] failed:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
