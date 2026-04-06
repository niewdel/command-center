import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { syncIcsFeed } from "@/lib/integrations/calendar/ics-adapter";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST() {
  try {
    const supabase = getSupabaseAdmin();

    const { data: connections } = await supabase
      .from("calendar_connections")
      .select("id, display_name, last_synced_at")
      .eq("is_active", true)
      .eq("is_ics_feed", true);

    if (!connections || connections.length === 0) {
      return NextResponse.json({ message: "No feeds to sync", synced: 0 });
    }

    // Only sync connections that haven't been synced in the last 5 minutes
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const stale = connections.filter(
      (c) => !c.last_synced_at || c.last_synced_at < fiveMinAgo
    );

    if (stale.length === 0) {
      return NextResponse.json({ message: "All feeds are fresh", synced: 0 });
    }

    const results = [];
    for (const conn of stale) {
      const result = await syncIcsFeed(conn.id);
      results.push({
        connection: conn.display_name || conn.id,
        ...result,
      });
    }

    return NextResponse.json({ synced: stale.length, results });
  } catch (error) {
    console.error("Sync-all error:", error);
    return NextResponse.json(
      { error: "Failed to sync calendars" },
      { status: 500 }
    );
  }
}
