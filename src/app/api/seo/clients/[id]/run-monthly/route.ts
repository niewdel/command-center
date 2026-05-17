import { NextRequest, NextResponse } from "next/server";
import { getSeoClient, createSeoJob, updateSeoJob } from "@/lib/seo/db";
import { runMonthlyReport } from "@/lib/seo/monthly-report";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Manual trigger for a monthly_report job. The "Email preview" button on the
// client page always routes the email to the operator (PREVIEW_RECIPIENT),
// never the client — the 1st-of-month cron is what delivers to the client.
const PREVIEW_RECIPIENT = "justin.ledwein@niewdel.com";

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
    type: "monthly_report",
  });

  setImmediate(() => {
    runMonthlyReport(job.id, { overrideEmail: PREVIEW_RECIPIENT }).catch(async (err) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[seo:run-monthly] job ${job.id} threw:`, msg);
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

  return NextResponse.json({ jobId: job.id });
}
