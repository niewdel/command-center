// Generates the public client-facing magic link for the standalone SEO
// report. The token signs (client_id, "view") with no time bucket, so the
// link is permanent unless SEO_REPORT_PRINT_SECRET is rotated.

import { NextRequest, NextResponse } from "next/server";
import { signViewToken } from "@/lib/seo/report-print-token";
import { requireAgencyAdmin } from "@/lib/tenancy";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAgencyAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    "https://app.niewdel.com";
  try {
    const token = signViewToken(id);
    const url = `${baseUrl}/seo/clients/${id}/report?view=1&token=${token}`;
    return NextResponse.json({ url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
