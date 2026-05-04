import { crawlSite } from "@/lib/audit/crawl";
import { runPerformanceAudit } from "@/lib/audit/performance";
import type { PSIMetrics } from "@/lib/audit/types";
import {
  getServiceClient,
  getSeoJob,
  getSeoClient,
  insertSeoCheck,
  upsertOpenIssue,
  resolveMissingIssues,
  updateSeoJob,
} from "./db";
import {
  pageToSnapshot,
  extractPageIssues,
  extractSiteIssues,
  extractPSIIssues,
} from "./issue-extract";
import { runSiteLevelChecks } from "./site-checks";
import { computeScores } from "./scoring";
import { computeDiff } from "./diff";
import { generateCheckSummary } from "./claude";
import type { SeoIssueDraft } from "./types";

const DEFAULT_MAX_PAGES = 25;

// Normalize a domain into a fetchable https URL.
function domainToUrl(domain: string): string {
  let d = domain.trim().toLowerCase();
  if (d.startsWith("http://")) d = d.slice(7);
  if (d.startsWith("https://")) d = d.slice(8);
  d = d.replace(/\/+$/, "");
  return `https://${d}`;
}

/**
 * Run the weekly SEO check pipeline for a single client.
 * Mirrors the leads/pipeline pattern: writes progress to seo_jobs every stage,
 * fires-and-forgets via setImmediate from the caller, and is safe to retry.
 */
export async function runWeeklyCheck(jobId: string): Promise<void> {
  const log = (msg: string) => console.log(`[seo ${jobId}] ${msg}`);
  const job = await getSeoJob(jobId);
  if (!job) throw new Error(`SEO job not found: ${jobId}`);
  if (job.type !== "weekly_check") {
    throw new Error(`Expected weekly_check, got ${job.type}`);
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
  const domain = client.seo_config.domain;
  const rootUrl = domainToUrl(domain);
  const maxPages = client.seo_config.crawl_config?.max_pages ?? DEFAULT_MAX_PAGES;

  const t0 = Date.now();
  await updateSeoJob(jobId, {
    status: "running",
    current_stage: `Crawling ${domain}`,
    progress_pct: 5,
    started_at: new Date().toISOString(),
  });

  // ------- Stage 1: Crawl -------
  log(`Crawl ${rootUrl} (max ${maxPages} pages)`);
  const pages = await crawlSite(
    rootUrl,
    (msg, done, total) => {
      const pct = total > 0 ? 5 + Math.round((done / total) * 40) : 5;
      void updateSeoJob(jobId, {
        current_stage: msg.length > 80 ? msg.slice(0, 77) + "..." : msg,
        progress_pct: pct,
      });
    },
    { maxPages }
  );

  if (pages.length === 0) {
    await updateSeoJob(jobId, {
      status: "failed",
      error_message: `Crawler returned 0 pages for ${rootUrl}. Site may be unreachable, blocked, or returning only non-HTML.`,
      completed_at: new Date().toISOString(),
    });
    return;
  }

  log(`Crawled ${pages.length} pages`);

  // ------- Stage 2: PSI on top 5 pages -------
  // Phase 1 keeps PSI to a small page subset to bound runtime + quota.
  // Dedupe by normalized URL: the crawler normalizes path '/' onto the
  // root, so 'https://niewdel.com' and 'https://niewdel.com/' would both
  // end up here unless we strip trailing slashes consistently before the
  // Set comparison.
  const normalizeForDedup = (u: string): string => {
    try {
      const url = new URL(u);
      url.hash = "";
      url.search = "";
      url.pathname = url.pathname.replace(/\/+$/, "") || "/";
      return url.toString();
    } catch {
      return u;
    }
  };
  const seenPsi = new Set<string>();
  const psiTargets: string[] = [];
  for (const candidate of [rootUrl, ...pages.map((p) => p.url)]) {
    const norm = normalizeForDedup(candidate);
    if (seenPsi.has(norm)) continue;
    seenPsi.add(norm);
    psiTargets.push(norm);
    if (psiTargets.length >= 5) break;
  }
  await updateSeoJob(jobId, {
    current_stage: `Running PageSpeed (${psiTargets.length} pages)`,
    progress_pct: 50,
  });
  const psi: PSIMetrics[] = await runPerformanceAudit(psiTargets, (msg) =>
    log(`  [PSI] ${msg}`)
  );
  const psiByUrl = new Map<string, PSIMetrics>();
  for (const p of psi) psiByUrl.set(p.url, p);
  log(`PSI completed for ${psi.length}/${psiTargets.length} pages`);

  // ------- Stage 3: Build per-page snapshots + scores -------
  await updateSeoJob(jobId, {
    current_stage: "Scoring + extracting issues",
    progress_pct: 80,
  });
  const snapshots = pages.map((p) => {
    const m = psiByUrl.get(p.url);
    return pageToSnapshot(p, m?.scores.performance);
  });
  const scores = computeScores(pages, psi);

  // ------- Stage 4: Persist seo_check -------
  const sb = getServiceClient();
  const { id: checkId } = await insertSeoCheck({
    job_id: jobId,
    workspace_id: job.workspace_id,
    client_id: job.client_id,
    scores,
    pages: snapshots,
  });

  // Stamp the result_id back onto the job so the UI can deep-link.
  await sb.from("seo_jobs").update({ result_id: checkId }).eq("id", jobId);

  // ------- Stage 5: Issue extraction + upsert -------
  await updateSeoJob(jobId, {
    current_stage: "Site-level checks (robots, llms.txt, AI bots)",
    progress_pct: 84,
  });

  const drafts: SeoIssueDraft[] = [];
  // Site-level (robots.txt, AI bot blocks, /llms.txt, /pricing.md)
  drafts.push(...(await runSiteLevelChecks(rootUrl)));
  // Per-page issues
  for (const page of pages) drafts.push(...extractPageIssues(page, rootUrl));
  // Cross-page issues (duplicate titles/metas)
  drafts.push(...extractSiteIssues(pages, rootUrl));
  // PSI-derived perf issues
  for (const url of psiByUrl.keys()) {
    const m = psiByUrl.get(url)!;
    drafts.push(...extractPSIIssues(url, m));
  }

  let newCount = 0;
  for (const d of drafts) {
    const { isNew } = await upsertOpenIssue(
      job.client_id,
      job.workspace_id,
      checkId,
      d
    );
    if (isNew) newCount++;
  }

  // Resolve any open issues whose fingerprint didn't appear this run.
  const observed = new Set(drafts.map((d) => d.fingerprint));
  const resolvedCount = await resolveMissingIssues(
    job.client_id,
    checkId,
    observed
  );

  // ------- Stage 6: Diff vs previous + AI summary -------
  await updateSeoJob(jobId, {
    current_stage: "Computing diff and summary",
    progress_pct: 92,
  });

  const diff = await computeDiff({
    client_id: job.client_id,
    exclude_check_id: checkId,
    current_pages: snapshots,
    current_scores: scores,
    observed_open_fingerprints: observed,
    newly_inserted_count: newCount,
    resolved_count: resolvedCount,
  });

  // Top issues for the Claude prompt — severity-sorted, capped.
  const severityRank: Record<string, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };
  const topIssues = drafts
    .slice()
    .sort(
      (a, b) =>
        (severityRank[a.severity] ?? 99) - (severityRank[b.severity] ?? 99)
    )
    .slice(0, 8)
    .map((d) => ({
      severity: d.severity,
      title: d.title,
      page_url: d.page_url ?? null,
    }));

  let aiSummary: string | null = null;
  let claudeUsed = false;
  try {
    aiSummary = await generateCheckSummary({
      domain,
      client_name: client.name,
      scores,
      diff,
      top_issues: topIssues,
      is_first_run: diff.previous_check_id === null,
    });
    claudeUsed = true;
  } catch (err) {
    log(`Claude summary failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Patch the seo_check row with diff + summary
  await sb
    .from("seo_checks")
    .update({ diff_from_previous: diff, ai_summary: aiSummary })
    .eq("id", checkId);

  // ------- Done -------
  const elapsedMs = Date.now() - t0;
  await updateSeoJob(jobId, {
    status: "complete",
    progress_pct: 100,
    current_stage: `Done. ${pages.length} pages, ${drafts.length} issues (${newCount} new, ${resolvedCount} resolved).`,
    completed_at: new Date().toISOString(),
    metadata: {
      pages_crawled: pages.length,
      psi_calls: psi.length,
      issues_total: drafts.length,
      issues_new: newCount,
      issues_resolved: resolvedCount,
      claude_summary: claudeUsed,
      wall_time_ms: elapsedMs,
    },
  });

  log(
    `Complete in ${(elapsedMs / 1000).toFixed(1)}s — score (technical=${scores.technical}, onpage=${scores.onpage}, mobile=${scores.lighthouse_mobile})`
  );
}
