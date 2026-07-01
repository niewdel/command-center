// Generates the public client-facing magic link for the Customer Portal
// (/portal/[id]). Reuses the same non-expiring view token as the standalone
// report magic link — one token per client, valid for both surfaces until
// SEO_REPORT_PRINT_SECRET is rotated.

import { NextRequest, NextResponse } from "next/server";
import { signViewToken } from "@/lib/seo/report-print-token";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    "https://app.niewdel.com";
  try {
    const token = signViewToken(id);
    const url = `${baseUrl}/portal/${id}?token=${token}`;
    return NextResponse.json({ url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
