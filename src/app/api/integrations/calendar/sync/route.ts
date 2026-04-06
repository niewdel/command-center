import { NextRequest, NextResponse } from "next/server";
import { syncIcsFeed } from "@/lib/integrations/calendar/ics-adapter";

export async function POST(request: NextRequest) {
  try {
    const { connectionId } = await request.json();
    if (!connectionId) {
      return NextResponse.json({ error: "connectionId required" }, { status: 400 });
    }

    const result = await syncIcsFeed(connectionId);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Manual sync error:", error);
    return NextResponse.json(
      { error: "Failed to sync calendar" },
      { status: 500 }
    );
  }
}
