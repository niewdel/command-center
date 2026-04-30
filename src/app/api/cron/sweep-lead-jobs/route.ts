import { NextRequest, NextResponse } from "next/server";
import { sweepStaleLeadJobs } from "@/lib/leads/db";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const headerSecret =
      request.headers.get("x-cron-secret") ||
      request.headers.get("authorization")?.replace("Bearer ", "");
    if (headerSecret?.trim() !== cronSecret.trim()) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const swept = await sweepStaleLeadJobs();
    return NextResponse.json({ swept: swept.length, ids: swept });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Lead-job sweep error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
