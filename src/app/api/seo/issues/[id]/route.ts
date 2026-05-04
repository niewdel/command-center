import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/seo/db";

export const dynamic = "force-dynamic";

// PATCH /api/seo/issues/[id]
// Body: { status: 'open' | 'fixed' | 'ignored' }
// When marking fixed/ignored, stamps resolved_at to now() so digest + monthly
// report logic can credit the resolution.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let body: { status?: string };
  try {
    body = (await request.json()) as { status?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const status = body.status;
  if (status !== "open" && status !== "fixed" && status !== "ignored") {
    return NextResponse.json(
      { error: "status must be open|fixed|ignored" },
      { status: 400 }
    );
  }

  const sb = getServiceClient();
  const patch: Record<string, unknown> = { status };
  if (status === "open") {
    patch.resolved_at = null;
    patch.resolved_check_id = null;
  } else {
    patch.resolved_at = new Date().toISOString();
  }

  const { error } = await sb.from("seo_issues").update(patch).eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
