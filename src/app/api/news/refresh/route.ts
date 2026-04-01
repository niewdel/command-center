import { NextResponse } from "next/server";

export async function POST() {
  try {
    const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl) {
      return NextResponse.json({ error: "APP_URL not configured" }, { status: 500 });
    }

    const res = await fetch(`${appUrl}/api/cron/refresh-news`, {
      method: "POST",
      headers: {
        "x-cron-secret": process.env.CRON_SECRET || "",
      },
    });

    const body = await res.json().catch(() => ({ error: "Invalid response" }));
    return NextResponse.json(body, { status: res.status });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
