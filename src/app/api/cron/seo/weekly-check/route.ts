import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { listEnabledSeoClients, createSeoJob } from "@/lib/seo/db";
import { runWeeklyCheck } from "@/lib/seo/pipeline";

export const dynamic = "force-dynamic";

// Weekly cron: enqueue a weekly_check job per enabled SEO client and kick
// each one off async. The HTTP response returns immediately; jobs run via
// setImmediate in this process.
export async function POST(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const clients = await listEnabledSeoClients();
    const enqueued: { jobId: string; clientId: string; name: string }[] = [];

    for (const c of clients) {
      const job = await createSeoJob({
        workspace_id: c.workspace_id,
        client_id: c.id,
        type: "weekly_check",
      });
      enqueued.push({ jobId: job.id, clientId: c.id, name: c.name });

      // Fire-and-forget. If the process dies the sweep cron will mark this
      // as failed via the heartbeat timeout.
      setImmediate(() => {
        runWeeklyCheck(job.id).catch(async (err) => {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`[seo:weekly-check] job ${job.id} threw:`, msg);
          // Best-effort failure marker — sweep covers us if this also fails.
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
    }

    return NextResponse.json({
      enqueued: enqueued.length,
      jobs: enqueued,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("seo weekly-check error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
