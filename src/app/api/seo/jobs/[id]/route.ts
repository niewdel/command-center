import { NextRequest, NextResponse } from "next/server";
import { getSeoJob } from "@/lib/seo/db";
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
  const job = await getSeoJob(id);
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }
  return NextResponse.json(job);
}
