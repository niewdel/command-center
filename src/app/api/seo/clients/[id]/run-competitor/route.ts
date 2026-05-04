import { NextRequest, NextResponse } from "next/server";
import { getSeoClient, createSeoJob, updateSeoJob } from "@/lib/seo/db";
import { runPaidCompetitorCheck } from "@/lib/seo/paid-competitor";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: clientId } = await params;
  const client = await getSeoClient(clientId);
  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }
  if ((client.seo_config?.competitor_domains ?? []).length === 0) {
    return NextResponse.json(
      { error: "No competitor_domains configured." },
      { status: 400 }
    );
  }

  const job = await createSeoJob({
    workspace_id: client.workspace_id,
    client_id: client.id,
    type: "paid_competitor",
  });

  setImmediate(() => {
    runPaidCompetitorCheck(job.id).catch(async (err) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[seo:run-competitor] job ${job.id} threw:`, msg);
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
