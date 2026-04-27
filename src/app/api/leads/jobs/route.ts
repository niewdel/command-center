import { NextRequest, NextResponse } from "next/server";
import { getServiceClient, getOrg } from "@/lib/leads/db";
import { runPipeline } from "@/lib/leads/pipeline";

// Audit/scrape jobs need real wall-clock time on Railway. Default Railway
// function timeout is 5 min; the pipeline can take 3-8 min for 25 leads,
// so we use the App Router's request streaming model: we return early and
// continue the async work in the background event loop.

export const maxDuration = 300;
export const dynamic = "force-dynamic";

type CreateJobBody = {
  vertical_name?: string;
  industries?: string[];
  geo?: string[];
  locations?: string[];
  revenue_ranges?: string[];
  employee_ranges?: string[];
  icp_description?: string;
  target_count?: number;
};

export async function POST(req: NextRequest) {
  let body: CreateJobBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.vertical_name?.trim()) {
    return NextResponse.json(
      { error: "vertical_name is required" },
      { status: 400 }
    );
  }
  if (!body.industries?.length) {
    return NextResponse.json(
      { error: "At least one industry keyword is required" },
      { status: 400 }
    );
  }

  const targetCount = clamp(body.target_count ?? 25, 1, 100);

  const sb = getServiceClient();
  const org = await getOrg();

  // Create vertical for this run
  const { data: vertical, error: vErr } = await sb
    .from("verticals")
    .insert({
      org_id: org.id,
      name: body.vertical_name.trim(),
      icp: {
        industries: body.industries,
        geo: body.geo ?? [],
        description: body.icp_description ?? "",
      },
      scrape_params: {
        apollo_filters: {
          organization_revenue_ranges: body.revenue_ranges ?? undefined,
          organization_num_employees_ranges: body.employee_ranges ?? undefined,
          organization_locations: body.locations ?? undefined,
        },
      },
      outreach_config: {},
      is_active: true,
    })
    .select()
    .single();

  if (vErr || !vertical) {
    return NextResponse.json(
      { error: `Failed to create vertical: ${vErr?.message}` },
      { status: 500 }
    );
  }

  // Create job
  const { data: job, error: jErr } = await sb
    .from("lead_jobs")
    .insert({
      user_id: org.user_id,
      org_id: org.id,
      vertical_id: vertical.id,
      target_count: targetCount,
      criteria: {
        industries: body.industries,
        geo: body.geo ?? [],
        revenue_ranges: body.revenue_ranges ?? [],
        employee_ranges: body.employee_ranges ?? [],
        locations: body.locations ?? [],
        icp_description: body.icp_description ?? "",
      },
      status: "queued",
      progress_pct: 0,
    })
    .select()
    .single();

  if (jErr || !job) {
    return NextResponse.json(
      { error: `Failed to create job: ${jErr?.message}` },
      { status: 500 }
    );
  }

  // Kick off pipeline async — returns to caller immediately while
  // the pipeline continues running in the Node event loop.
  setImmediate(() => {
    runPipeline(job.id).catch(async (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      try {
        await sb
          .from("lead_jobs")
          .update({
            status: "failed",
            error: msg,
            completed_at: new Date().toISOString(),
          })
          .eq("id", job.id);
      } catch {
        // already logging via console
      }
      console.error(`[lead-job ${job.id}] failed:`, msg);
    });
  });

  return NextResponse.json({ id: job.id, vertical_id: vertical.id });
}

export async function GET(req: NextRequest) {
  const sb = getServiceClient();
  const limit = parseInt(req.nextUrl.searchParams.get("limit") ?? "20");
  const { data, error } = await sb
    .from("lead_jobs")
    .select("*, verticals(name)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data });
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
