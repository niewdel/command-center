import { NextRequest, NextResponse } from "next/server";
import { getReportData } from "@/lib/seo/report-data";
import type { ReportRange } from "@/lib/seo/report-data";

export const dynamic = "force-dynamic";

const VALID_RANGES: ReportRange[] = ["30d", "90d", "life"];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const sp = request.nextUrl.searchParams;
  const rangeParam = sp.get("range") ?? "30d";
  const range: ReportRange = (VALID_RANGES as string[]).includes(rangeParam)
    ? (rangeParam as ReportRange)
    : "30d";

  try {
    const data = await getReportData(id, range);
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
