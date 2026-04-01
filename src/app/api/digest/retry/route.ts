import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { digestId } = await request.json();
    if (!digestId) {
      return NextResponse.json({ error: "digestId is required" }, { status: 400 });
    }

    const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl) {
      return NextResponse.json({ error: "APP_URL not configured" }, { status: 500 });
    }

    // Trigger processing server-side (has access to DIGEST_PROCESS_SECRET)
    const res = await fetch(`${appUrl}/api/digest/process`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.DIGEST_PROCESS_SECRET}`,
      },
      body: JSON.stringify({ digestId }),
    });

    const body = await res.json().catch(() => ({ error: "Invalid response" }));
    return NextResponse.json(body, { status: res.status });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
