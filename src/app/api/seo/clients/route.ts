import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/seo/db";
import { requireAgencyAdmin } from "@/lib/tenancy";

export const dynamic = "force-dynamic";

// Returns all clients that have ANY seo_config (enabled or paused), with the
// latest seo_check + open issue counts. Used by the /seo overview page.
export async function GET() {
  if (!(await requireAgencyAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const sb = getServiceClient();

  const { data: clients, error } = await sb
    .from("clients")
    .select("id, workspace_id, name, seo_config")
    .not("seo_config", "is", null)
    .order("name");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (clients ?? []) as Array<{
    id: string;
    workspace_id: string;
    name: string;
    seo_config: Record<string, unknown> | null;
  }>;

  // Latest check per client
  const checksByClient = new Map<string, Record<string, unknown>>();
  if (rows.length > 0) {
    const ids = rows.map((r) => r.id);
    const { data: checks } = await sb
      .from("seo_checks")
      .select("client_id, technical_score, lighthouse_mobile, lighthouse_desktop, onpage_score, freshness_days, pages_crawled, ai_summary, diff_from_previous, created_at")
      .in("client_id", ids)
      .order("created_at", { ascending: false });
    for (const c of checks ?? []) {
      const cid = c.client_id as string;
      if (!checksByClient.has(cid)) checksByClient.set(cid, c);
    }
  }

  // Open issue counts per client
  const issuesByClient = new Map<string, { open: number; critical: number }>();
  if (rows.length > 0) {
    const ids = rows.map((r) => r.id);
    const { data: issues } = await sb
      .from("seo_issues")
      .select("client_id, severity")
      .in("client_id", ids)
      .eq("status", "open");
    for (const i of issues ?? []) {
      const cid = i.client_id as string;
      const cur = issuesByClient.get(cid) ?? { open: 0, critical: 0 };
      cur.open += 1;
      if (i.severity === "critical") cur.critical += 1;
      issuesByClient.set(cid, cur);
    }
  }

  // Active job per client
  const activeByClient = new Map<string, Record<string, unknown>>();
  if (rows.length > 0) {
    const ids = rows.map((r) => r.id);
    const { data: jobs } = await sb
      .from("seo_jobs")
      .select("client_id, id, status, current_stage, progress_pct, created_at")
      .in("client_id", ids)
      .in("status", ["queued", "running"])
      .order("created_at", { ascending: false });
    for (const j of jobs ?? []) {
      const cid = j.client_id as string;
      if (!activeByClient.has(cid)) activeByClient.set(cid, j);
    }
  }

  return NextResponse.json({
    data: rows.map((r) => ({
      id: r.id,
      workspace_id: r.workspace_id,
      name: r.name,
      seo_config: r.seo_config,
      latest_check: checksByClient.get(r.id) ?? null,
      open_issues: issuesByClient.get(r.id) ?? { open: 0, critical: 0 },
      active_job: activeByClient.get(r.id) ?? null,
    })),
  });
}
