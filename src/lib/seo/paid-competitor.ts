// paid_competitor job executor — competitor gap analysis. For each competitor
// domain, pulls the keywords the competitor ranks for, diffs against the
// client's own ranked keywords, and stores gap opportunities (keywords the
// competitor ranks for but the client does not).

import {
  getServiceClient,
  getSeoJob,
  getSeoClient,
  updateSeoJob,
} from "./db";
import {
  fetchRankedKeywords,
  isDataForSeoConfigured,
  type RankedKeyword,
} from "./dataforseo";

function stripScheme(domain: string): string {
  return domain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/+$/, "");
}

interface GapEntry {
  competitor_domain: string;
  keyword: string;
  competitor_rank: number;
  competitor_url: string | null;
  search_volume: number | null;
  cpc: number | null;
}

export async function runPaidCompetitorCheck(jobId: string): Promise<void> {
  const log = (msg: string) => console.log(`[seo-comp ${jobId}] ${msg}`);
  const job = await getSeoJob(jobId);
  if (!job) throw new Error(`SEO job not found: ${jobId}`);
  if (job.type !== "paid_competitor") {
    throw new Error(`Expected paid_competitor, got ${job.type}`);
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

  const competitors = (client.seo_config.competitor_domains ?? [])
    .filter((c) => c && c.trim().length > 0)
    .map(stripScheme);

  if (competitors.length === 0) {
    await updateSeoJob(jobId, {
      status: "failed",
      error_message: "No competitor_domains configured for this client.",
      completed_at: new Date().toISOString(),
    });
    return;
  }

  const clientDomain = stripScheme(client.seo_config.domain);
  const sb = getServiceClient();
  const t0 = Date.now();

  await updateSeoJob(jobId, {
    status: "running",
    started_at: new Date().toISOString(),
    current_stage: `Loading client baseline for ${clientDomain}`,
    progress_pct: 5,
  });

  // Pull the client's ranked keywords first — this is the baseline we diff
  // each competitor against.
  let clientRanked: RankedKeyword[] = [];
  try {
    clientRanked = await fetchRankedKeywords({
      domain: clientDomain,
      limit: 200,
    });
    log(`Client domain ranks for ${clientRanked.length} keywords`);
  } catch (err) {
    log(
      `Failed to fetch client baseline: ${err instanceof Error ? err.message : String(err)}`
    );
  }
  const clientKeywords = new Set(
    clientRanked.map((r) => r.keyword.toLowerCase())
  );

  const allGaps: GapEntry[] = [];
  let i = 0;
  for (const competitor of competitors) {
    i++;
    await updateSeoJob(jobId, {
      current_stage: `[${i}/${competitors.length}] ${competitor}`,
      progress_pct: 5 + Math.round((i / competitors.length) * 75),
    });

    try {
      const competitorRanked = await fetchRankedKeywords({
        domain: competitor,
        limit: 200,
      });
      log(`${competitor}: ${competitorRanked.length} ranked keywords`);

      // Gaps: keywords competitor ranks for that client doesn't.
      const gaps = competitorRanked.filter(
        (r) => !clientKeywords.has(r.keyword.toLowerCase())
      );

      // Sort by search_volume desc, take top 50 gaps per competitor.
      gaps.sort(
        (a, b) => (b.search_volume ?? 0) - (a.search_volume ?? 0)
      );
      const top = gaps.slice(0, 50);

      for (const g of top) {
        allGaps.push({
          competitor_domain: competitor,
          keyword: g.keyword,
          competitor_rank: g.rank_absolute,
          competitor_url: g.url,
          search_volume: g.search_volume,
          cpc: g.cpc,
        });
      }
    } catch (err) {
      log(
        `Failed for ${competitor}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  await updateSeoJob(jobId, {
    current_stage: `Persisting ${allGaps.length} gap entries`,
    progress_pct: 85,
  });

  // Replace prior gap snapshot for this client (latest run wins).
  const { error: deleteErr } = await sb
    .from("seo_competitor_gaps")
    .delete()
    .eq("client_id", job.client_id);
  if (deleteErr) log(`delete prior gaps failed: ${deleteErr.message}`);

  if (allGaps.length > 0) {
    const rows = allGaps.map((g) => ({
      workspace_id: job.workspace_id,
      client_id: job.client_id,
      job_id: jobId,
      competitor_domain: g.competitor_domain,
      keyword: g.keyword,
      competitor_rank: g.competitor_rank,
      competitor_url: g.competitor_url,
      search_volume: g.search_volume,
      cpc: g.cpc,
      captured_at: new Date().toISOString(),
    }));
    const { error: insertErr } = await sb
      .from("seo_competitor_gaps")
      .insert(rows);
    if (insertErr) log(`insert gaps failed: ${insertErr.message}`);
  }

  const elapsedMs = Date.now() - t0;

  await updateSeoJob(jobId, {
    status: "complete",
    progress_pct: 100,
    current_stage: `Done. ${allGaps.length} gap opportunities across ${competitors.length} competitors.`,
    completed_at: new Date().toISOString(),
    metadata: {
      competitors_analyzed: competitors.length,
      client_keywords: clientRanked.length,
      gaps_found: allGaps.length,
      wall_time_ms: elapsedMs,
    },
  });
}
