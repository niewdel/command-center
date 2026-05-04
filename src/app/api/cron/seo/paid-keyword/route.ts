import { NextRequest, NextResponse } from "next/server";
import { listEnabledSeoClients, createSeoJob, updateSeoJob } from "@/lib/seo/db";
import { runPaidKeywordCheck } from "@/lib/seo/paid-keyword";
import { isDataForSeoConfigured } from "@/lib/seo/dataforseo";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

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

  if (!isDataForSeoConfigured()) {
    return NextResponse.json({
      enqueued: 0,
      reason: "DataForSEO not configured (DATAFORSEO_LOGIN/PASSWORD env)",
    });
  }

  try {
    const clients = await listEnabledSeoClients();
    const targets = clients.filter(
      (c) =>
        c.seo_config?.paid_tracking_enabled === true &&
        (c.seo_config.target_keywords ?? []).length > 0
    );

    const enqueued: { jobId: string; clientId: string; name: string }[] = [];
    for (const c of targets) {
      const job = await createSeoJob({
        workspace_id: c.workspace_id,
        client_id: c.id,
        type: "paid_keyword",
      });
      enqueued.push({ jobId: job.id, clientId: c.id, name: c.name });

      setImmediate(() => {
        runPaidKeywordCheck(job.id).catch(async (err) => {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`[seo:paid-keyword] job ${job.id} threw:`, msg);
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

    return NextResponse.json({ enqueued: enqueued.length, jobs: enqueued });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("seo paid-keyword error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
