import { NextRequest, NextResponse } from "next/server";
import { listEnabledSeoClients, createSeoJob, updateSeoJob } from "@/lib/seo/db";
import { runMonthlyReport } from "@/lib/seo/monthly-report";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Monthly cron: enqueue a monthly_report job per enabled SEO client whose
// report_status is 'enabled' (default) and kick each off async. PDF generation
// runs via Playwright print-to-PDF, then emails the link to contact_email.
export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const headerSecret =
      request.headers.get("x-cron-secret") ||
      request.headers.get("authorization")?.replace("Bearer ", "");
    if (headerSecret?.trim() !== cronSecret.trim()) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const clients = await listEnabledSeoClients();
    const targets = clients.filter(
      (c) => c.seo_config?.report_status !== "paused"
    );

    const enqueued: { jobId: string; clientId: string; name: string }[] = [];

    for (const c of targets) {
      const job = await createSeoJob({
        workspace_id: c.workspace_id,
        client_id: c.id,
        type: "monthly_report",
      });
      enqueued.push({ jobId: job.id, clientId: c.id, name: c.name });

      setImmediate(() => {
        runMonthlyReport(job.id).catch(async (err) => {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`[seo:monthly-report] job ${job.id} threw:`, msg);
          try {
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
    console.error("seo monthly-report error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
