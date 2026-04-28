import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { syncIcsFeed } from "@/lib/integrations/calendar/ics-adapter";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const headerSecret =
        request.headers.get("x-cron-secret") ||
        request.headers.get("authorization")?.replace("Bearer ", "");
      if (headerSecret?.trim() !== cronSecret.trim()) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const supabase = getSupabaseAdmin();

    // Fetch all active ICS feed connections
    const { data: connections } = await supabase
      .from("calendar_connections")
      .select("id, display_name")
      .eq("is_active", true)
      .eq("is_ics_feed", true);

    if (!connections || connections.length === 0) {
      return NextResponse.json({ message: "No ICS feeds to sync", synced: 0 });
    }

    // allSettled so a single broken feed doesn't kill the cron for the rest.
    const settled = await Promise.allSettled(
      connections.map(async (conn) => {
        const result = await syncIcsFeed(conn.id);
        return { connection: conn.display_name || conn.id, ...result };
      })
    );

    const results = settled.map((s, i) =>
      s.status === "fulfilled"
        ? s.value
        : {
            connection: connections[i].display_name || connections[i].id,
            errors: [s.reason instanceof Error ? s.reason.message : String(s.reason)],
            added: 0,
            updated: 0,
            deleted: 0,
          }
    );

    return NextResponse.json({ synced: connections.length, results });
  } catch (error) {
    console.error("Calendar sync error:", error);
    return NextResponse.json(
      { error: "Failed to sync calendars" },
      { status: 500 }
    );
  }
}
