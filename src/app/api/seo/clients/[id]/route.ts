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

  // Latest keyword rank per keyword + the prior rank for delta. We pull the
  // last 60 captures, then dedup keyword → newest two rows.
  const { data: rawRanks } = await sb
    .from("seo_keyword_ranks")
    .select("keyword, rank, url, captured_at")
    .eq("client_id", id)
    .order("captured_at", { ascending: false })
    .limit(200);

  type KwRow = {
    keyword: string;
    rank: number | null;
    url: string | null;
    captured_at: string;
  };
  const latestByKw = new Map<
    string,
    {
      keyword: string;
      rank: number | null;
      url: string | null;
      captured_at: string;
      prior_rank: number | null;
      delta: number | null;
    }
  >();
  for (const r of (rawRanks ?? []) as KwRow[]) {
    const existing = latestByKw.get(r.keyword);
    if (!existing) {
      latestByKw.set(r.keyword, {
        keyword: r.keyword,
        rank: r.rank,
        url: r.url,
        captured_at: r.captured_at,
        prior_rank: null,
        delta: null,
      });
    } else if (existing.prior_rank == null) {
      existing.prior_rank = r.rank;
      existing.delta =
        existing.rank != null && r.rank != null
          ? r.rank - existing.rank // positive = improved (rank went down = better position)
          : null;
    }
  }
  const keyword_ranks = [...latestByKw.values()];

  // Competitor gaps — current snapshot only (executor replaces on each run).
  const { data: gaps } = await sb
    .from("seo_competitor_gaps")
    .select(
      "competitor_domain, keyword, competitor_rank, competitor_url, search_volume, cpc, captured_at"
    )
    .eq("client_id", id)
    .order("search_volume", { ascending: false, nullsFirst: false })
    .limit(200);

  // GA4 traffic snapshots — most recent first, capped at 12 (covers ~3 months
  // at weekly cadence). Used by the traffic card + history sparklines.
  const { data: traffic } = await sb
    .from("seo_traffic_snapshots")
    .select(
      "id, period_start, period_end, sessions, users, page_views, organic_sessions, avg_session_duration_s, bounce_rate, top_pages, top_sources, captured_at"
    )
    .eq("client_id", id)
    .order("captured_at", { ascending: false })
    .limit(12);

  return NextResponse.json({
    client,
    checks: checks ?? [],
    issues: issues ?? [],
    jobs: jobs ?? [],
    keyword_ranks,
    competitor_gaps: gaps ?? [],
    traffic: traffic ?? [],
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
