import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { sweepStaleSeoJobs } from "@/lib/seo/db";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const swept = await sweepStaleSeoJobs();
    return NextResponse.json({ swept: swept.length, ids: swept });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("seo sweep error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
