import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/leads/db";
import { requireAgencyAdmin } from "@/lib/tenancy";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAgencyAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const { data, error } = await getServiceClient()
    .from("lead_jobs")
    .select("*, verticals(name)")
    .eq("id", id)
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  return NextResponse.json({ data });
}
