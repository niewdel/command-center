// paid_keyword job executor — tracks rank for each target_keyword on the
// client's domain via DataForSEO live SERP. Stores a snapshot per keyword
// in seo_keyword_ranks; the table also serves as week-over-week history.

import {
  getServiceClient,
  getSeoJob,
  getSeoClient,
  updateSeoJob,
} from "./db";
import {
  fetchSerp,
  findDomainRank,
  isDataForSeoConfigured,
  DataForSeoNotConfiguredError,
} from "./dataforseo";

function stripScheme(domain: string): string {
  return domain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/+$/, "");
}

export async function runPaidKeywordCheck(jobId: string): Promise<void> {
  const log = (msg: string) => console.log(`[seo-kw ${jobId}] ${msg}`);
  const job = await getSeoJob(jobId);
  if (!job) throw new Error(`SEO job not found: ${jobId}`);
  if (job.type !== "paid_keyword") {
    throw new Error(`Expected paid_keyword, got ${job.type}`);
  }

  if (!isDataForSeoConfigured()) {
    await updateSeoJob(jobId, {
      status: "failed",
      error_message:
        "DataForSEO not configured. Set DATAFORSEO_LOGIN + DATAFORSEO_PASSWORD env vars.",
      completed_at: new Date().toISOString(),
    });
    return;
  }

  const client = await getSeoClient(job.client_id);
  if (!client || !client.seo_config?.domain) {
    await updateSeoJob(jobId, {
      status: "failed",
      error_message: "Client has no seo_config.domain",
      completed_at: new Date().toISOString(),
    });
    return;
  }

  const keywords = (client.seo_config.target_keywords ?? []).filter(
    (k) => k && k.trim().length > 0
  );

  if (keywords.length === 0) {
    await updateSeoJob(jobId, {
      status: "failed",
      error_message: "No target_keywords configured for this client.",
      completed_at: new Date().toISOString(),
    });
    return;
  }

  const domain = stripScheme(client.seo_config.domain);
  const sb = getServiceClient();
  const t0 = Date.now();

  await updateSeoJob(jobId, {
    status: "running",
    started_at: new Date().toISOString(),
    current_stage: `Tracking ${keywords.length} keywords on ${domain}`,
    progress_pct: 5,
  });

  // Pull the most recent prior rank for each keyword for delta computation.
  const { data: priorRows } = await sb
    .from("seo_keyword_ranks")
    .select("keyword, rank")
    .eq("client_id", job.client_id)
    .in("keyword", keywords)
    .order("captured_at", { ascending: false })
    .limit(keywords.length * 2);
  const priorByKw = new Map<string, number | null>();
  for (const r of priorRows ?? []) {
    const kw = r.keyword as string;
    if (!priorByKw.has(kw)) priorByKw.set(kw, r.rank as number | null);
  }

  const snapshots: Array<{
    keyword: string;
    rank: number | null;
    prior_rank: number | null;
    url: string | null;
    delta: number | null;
  }> = [];

  let i = 0;
  for (const kw of keywords) {
    i++;
    await updateSeoJob(jobId, {
      current_stage: `[${i}/${keywords.length}] ${kw}`,
      progress_pct: 5 + Math.round((i / keywords.length) * 80),
    });

    try {
      const serp = await fetchSerp({ keyword: kw, depth: 50 });
      const hit = findDomainRank(serp, domain);
      const rank = hit?.rank ?? null;
      const url = hit?.url ?? null;
      const prior = priorByKw.get(kw) ?? null;
      const delta =
        rank != null && prior != null ? prior - rank : null; // positive = improved

      const { error: insertErr } = await sb.from("seo_keyword_ranks").insert({
        workspace_id: job.workspace_id,
        client_id: job.client_id,
        job_id: jobId,
        keyword: kw,
        rank,
        url,
        captured_at: new Date().toISOString(),
      });
      if (insertErr) log(`insert failed for "${kw}": ${insertErr.message}`);

      snapshots.push({
        keyword: kw,
        rank,
        prior_rank: prior,
        url,
        delta,
      });

      log(
        `${kw}: rank=${rank ?? "n/a"}${
          prior != null ? ` (was ${prior})` : ""
        }${delta != null ? `, delta=${delta > 0 ? "+" : ""}${delta}` : ""}`
      );
    } catch (err) {
      log(
        `Failed for "${kw}": ${err instanceof Error ? err.message : String(err)}`
      );
      if (err instanceof DataForSeoNotConfiguredError) {
        await updateSeoJob(jobId, {
          status: "failed",
          error_message: err.message,
          completed_at: new Date().toISOString(),
        });
        return;
      }
    }
  }

  const elapsedMs = Date.now() - t0;
  const ranked = snapshots.filter((s) => s.rank != null).length;
  const improved = snapshots.filter((s) => (s.delta ?? 0) > 0).length;
  const declined = snapshots.filter((s) => (s.delta ?? 0) < 0).length;

  await updateSeoJob(jobId, {
    status: "complete",
    progress_pct: 100,
    current_stage: `Done. ${ranked}/${keywords.length} ranking, +${improved} improved, -${declined} declined.`,
    completed_at: new Date().toISOString(),
    metadata: {
      keywords_tracked: keywords.length,
      keywords_ranking: ranked,
      keywords_improved: improved,
      keywords_declined: declined,
      snapshots,
      wall_time_ms: elapsedMs,
    },
  });
}
