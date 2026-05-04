import { NextRequest, NextResponse } from "next/server";
import { getSeoClient, createSeoJob } from "@/lib/seo/db";
import { runWeeklyCheck } from "@/lib/seo/pipeline";

export const dynamic = "force-dynamic";

// Manual trigger for a weekly-style SEO check on a single client.
// Mirrors the cron path but is auth-bound (runs in the user's session) and
// targets exactly one client.
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: clientId } = await params;

  const client = await getSeoClient(clientId);
  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }
  if (!client.seo_config?.enabled || !client.seo_config?.domain) {
    return NextResponse.json(
      { error: "Client is not configured for SEO monitoring" },
      { status: 400 }
    );
  }

  const job = await createSeoJob({
    workspace_id: client.workspace_id,
    client_id: client.id,
    type: "weekly_check",
  });

  setImmediate(() => {
    runWeeklyCheck(job.id).catch(async (err) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[seo:run-check] job ${job.id} threw:`, msg);
      try {
        const { updateSeoJob } = await import("@/lib/seo/db");
        await updateSeoJob(job.id, {
          status: "failed",
          error_message: msg,
          completed_at: new Date().toISOString(),
        });
      } catch {
        // ignore
      }
    });
  });

  return NextResponse.json({ jobId: job.id });
}
