// Thin wrapper around the dumpTask() helper. Actual logic lives in
// src/lib/tasks/dump.ts so the Telegram webhook can reuse the same code
// path without an HTTP round-trip.

import { NextRequest, NextResponse } from "next/server";
import { dumpTask } from "@/lib/tasks/dump";

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();
    const result = await dumpTask(text);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error("Dump error:", error);
    return NextResponse.json({ error: "Failed to process task" }, { status: 500 });
  }
}
