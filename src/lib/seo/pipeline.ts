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
  getWorkspaceOwner,
  insertTrafficSnapshot,
} from "./db";
import { fetchTrafficSnapshot } from "@/lib/google/ga4";
import { getConnection } from "@/lib/google/oauth";
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
    current_stage: `Running PageSpeed mobile + desktop (${psiTargets.length} pages)`,
    progress_pct: 50,
  });
  const [psiMobile, psiDesktop] = await Promise.all([
    runPerformanceAudit(psiTargets, (msg) => log(`  [PSI mob] ${msg}`), "mobile"),
    runPerformanceAudit(psiTargets, (msg) => log(`  [PSI dsk] ${msg}`), "desktop"),
  ]);
  const psiMobileByUrl = new Map<string, PSIMetrics>();
  const psiDesktopByUrl = new Map<string, PSIMetrics>();
  for (const p of psiMobile) psiMobileByUrl.set(p.url, p);
  for (const p of psiDesktop) psiDesktopByUrl.set(p.url, p);
  log(
    `PSI completed — mobile ${psiMobile.length}/${psiTargets.length}, desktop ${psiDesktop.length}/${psiTargets.length}`
  );

  // ------- Stage 3: Build per-page snapshots + scores -------
  await updateSeoJob(jobId, {
    current_stage: "Scoring + extracting issues",
    progress_pct: 80,
  });
  const snapshots = pages.map((p) => {
    const m = psiMobileByUrl.get(p.url);
    const d = psiDesktopByUrl.get(p.url);
    return pageToSnapshot(p, m?.scores.performance, d?.scores.performance);
  });
  const scores = await computeScores(pages, psiMobile, psiDesktop, {
    client_id: job.client_id,
    rootUrl,
    snapshots,
  });

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
  // PSI-derived perf issues are mobile-driven (Google ranks mobile-first).
  for (const url of psiMobileByUrl.keys()) {
    const m = psiMobileByUrl.get(url)!;
    drafts.push(...extractPSIIssues(url, m));
  }

  let newCount = 0;
  // Track new high/critical issues for the digest email trigger.
  // Auto-resolve of missing fingerprints (handled by resolveMissingIssues
  // below) is what credits Claude's fix-plan work — no manual marking needed.
  let newSevereCount = 0;
  for (const d of drafts) {
    const { isNew } = await upsertOpenIssue(
      job.client_id,
      job.workspace_id,
      checkId,
      d
    );
    if (isNew) {
      newCount++;
      if (d.severity === "critical" || d.severity === "high") {
        newSevereCount++;
      }
    }
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

  // ------- Stage 6.5: GA4 traffic snapshot (best-effort) -------
  // Pulls last 7 days of traffic data when the client has a ga4_property_id
  // configured AND the workspace owner has a connected Google account.
  // Failures are logged but never break the rest of the check — traffic is
  // a value-add, not a hard requirement.
  const ga4PropertyId = client.seo_config.ga4_property_id;
  let trafficCaptured = false;
  let trafficError: string | null = null;
  if (ga4PropertyId) {
    await updateSeoJob(jobId, {
      current_stage: "Fetching GA4 traffic snapshot",
      progress_pct: 94,
    });
    try {
      const ownerId = await getWorkspaceOwner(job.workspace_id);
      if (!ownerId) {
        trafficError = "no workspace owner found";
      } else {
        const conn = await getConnection(ownerId);
        if (!conn) {
          trafficError = "no Google connection for workspace owner";
        } else {
          const snap = await fetchTrafficSnapshot({
            user_id: ownerId,
            property_id: ga4PropertyId,
          });
          await insertTrafficSnapshot({
            workspace_id: job.workspace_id,
            client_id: job.client_id,
            job_id: jobId,
            ga4_property_id: ga4PropertyId,
            ...snap,
          });
          trafficCaptured = true;
          log(
            `GA4 traffic snapshot stored: ${snap.sessions} sessions, ${snap.organic_sessions} organic, ${snap.users} users (${snap.period_start} to ${snap.period_end})`
          );
        }
      }
    } catch (err) {
      trafficError = err instanceof Error ? err.message : String(err);
      log(`GA4 traffic fetch failed: ${trafficError}`);
    }
  }

  // ------- Done -------
  // Weekly runs never send email. Clients only receive the monthly report,
  // which aggregates the last ~4 weekly check runs via getReportData("30d").
  // Auto-task creation was also deliberately removed — Justin's workflow is
  // to copy the fix-plan markdown into Claude Code in the client's repo. The
  // resolveMissingIssues call above auto-marks issues as 'fixed' when their
  // fingerprints don't appear in the next run, so Claude's work gets credited
  // automatically without any manual button-clicking.
  const dryRun = client.seo_config.dry_run === true;
  const elapsedMs = Date.now() - t0;
  await updateSeoJob(jobId, {
    status: "complete",
    progress_pct: 100,
    current_stage: `Done. ${pages.length} pages, ${drafts.length} issues (${newCount} new, ${resolvedCount} resolved).`,
    completed_at: new Date().toISOString(),
    metadata: {
      pages_crawled: pages.length,
      psi_calls: psiMobile.length + psiDesktop.length,
      issues_total: drafts.length,
      issues_new: newCount,
      dry_run: dryRun,
      traffic_captured: trafficCaptured,
      traffic_error: trafficError,
      issues_resolved: resolvedCount,
      claude_summary: claudeUsed,
      wall_time_ms: elapsedMs,
    },
  });

  log(
    `Complete in ${(elapsedMs / 1000).toFixed(1)}s — score (technical=${scores.technical}, onpage=${scores.onpage}, mobile=${scores.lighthouse_mobile}, desktop=${scores.lighthouse_desktop})`
  );
}

