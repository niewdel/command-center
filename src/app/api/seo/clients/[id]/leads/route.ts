// Leads-by-channel summary for a SEO client. Booking / contact / call / email
// actions from GA4, attributed by acquisition channel, plus ad spend and
// cost-per-lead. Read-only.

import { NextRequest, NextResponse } from "next/server";
import { getLeadsSummary } from "@/lib/seo/leads";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const range = new URL(req.url).searchParams.get("range");
  const days = range === "90d" ? 90 : range === "7d" ? 7 : 30;

  try {
    const summary = await getLeadsSummary(id, days);
    return NextResponse.json(summary);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[leads] error:", msg);
    return NextResponse.json({ error: msg.slice(0, 200) }, { status: 500 });
  }
}
