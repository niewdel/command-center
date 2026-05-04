import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/seo/db";

export const dynamic = "force-dynamic";

// Detail for a single SEO client: full seo_config, recent checks (up to 12),
// and currently-open issues sorted by severity.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const sb = getServiceClient();

  const { data: client } = await sb
    .from("clients")
    .select("id, workspace_id, name, seo_config")
    .eq("id", id)
    .maybeSingle();

  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const { data: checks } = await sb
    .from("seo_checks")
    .select(
      "id, technical_score, lighthouse_mobile, lighthouse_desktop, onpage_score, freshness_days, pages_crawled, ai_summary, diff_from_previous, pages, created_at"
    )
    .eq("client_id", id)
    .order("created_at", { ascending: false })
    .limit(12);

  const { data: issues } = await sb
    .from("seo_issues")
    .select("*")
    .eq("client_id", id)
    .eq("status", "open")
    .order("severity", { ascending: true });

  const { data: jobs } = await sb
    .from("seo_jobs")
    .select("id, type, status, current_stage, progress_pct, error_message, started_at, completed_at, metadata, created_at")
    .eq("client_id", id)
    .order("created_at", { ascending: false })
    .limit(10);

  return NextResponse.json({
    client,
    checks: checks ?? [],
    issues: issues ?? [],
    jobs: jobs ?? [],
  });
}

// Update seo_config (for the settings drawer in /seo/clients/[id]).
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const sb = getServiceClient();

  let body: { seo_config?: Record<string, unknown> };
  try {
    body = (await request.json()) as { seo_config?: Record<string, unknown> };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.seo_config || typeof body.seo_config !== "object") {
    return NextResponse.json({ error: "seo_config required" }, { status: 400 });
  }

  const { error } = await sb
    .from("clients")
    .update({ seo_config: body.seo_config })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
