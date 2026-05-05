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
import { sendEmail, isEmailConfigured } from "@/lib/email/resend";
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

  // ------- Stage 7: Weekly digest email -------
  // Auto-task creation was deliberately removed — Justin's workflow is to
  // copy the fix-plan markdown into Claude Code in the client's repo. The
  // resolveMissingIssues call above already auto-marks issues as 'fixed'
  // when their fingerprints don't appear in the next run, so Claude's work
  // gets credited automatically without any manual button-clicking.
  const dryRun = client.seo_config.dry_run === true;
  let digestSent = false;
  let digestError: string | null = null;

  // Weekly digest email — fires only when not dry_run, contact_email configured,
  // Resend configured, and there's something worth reporting (new criticals/highs
  // OR notable score regression).
  const contactEmail = client.seo_config.contact_email;
  const hasRegression =
    (diff.score_deltas?.technical ?? 0) <= -5 ||
    (diff.score_deltas?.onpage ?? 0) <= -5 ||
    (diff.score_deltas?.lighthouse_mobile ?? 0) <= -5;
  const shouldDigest =
    !dryRun &&
    contactEmail &&
    isEmailConfigured() &&
    (newSevereCount > 0 || hasRegression);

  if (shouldDigest && contactEmail) {
    try {
      const dashboardBase =
        process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? "";
      const link = dashboardBase
        ? `${dashboardBase.replace(/\/$/, "")}/seo/clients/${job.client_id}`
        : null;
      await sendEmail({
        to: contactEmail,
        subject: `${client.name}: ${newSevereCount} new SEO issue${newSevereCount === 1 ? "" : "s"}`,
        html: buildDigestHtml({
          clientName: client.name,
          domain,
          newCount: newSevereCount,
          resolvedCount,
          scores,
          deltas: diff.score_deltas ?? {},
          topIssues,
          dashboardUrl: link,
          contactName: client.seo_config.contact_name ?? null,
        }),
      });
      digestSent = true;
      log(`Sent weekly digest to ${contactEmail}`);
    } catch (err) {
      digestError = err instanceof Error ? err.message : String(err);
      log(`Digest email failed: ${digestError}`);
    }
  }

  // ------- Done -------
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
      digest_sent: digestSent,
      digest_error: digestError,
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

// -----------------------------------------------------------------------------
// Weekly digest email body
// -----------------------------------------------------------------------------

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function severityColor(sev: string): string {
  switch (sev) {
    case "critical":
      return "#EF4444";
    case "high":
      return "#F59E0B";
    default:
      return "#9CA3AF";
  }
}

function deltaSpan(d: number | null | undefined): string {
  if (d == null || d === 0) return "";
  const sign = d > 0 ? "+" : "";
  const color = d > 0 ? "#10B981" : "#EF4444";
  return ` <span style="color:${color};font-size:11px;">(${sign}${d})</span>`;
}

interface DigestArgs {
  clientName: string;
  domain: string;
  newCount: number;
  resolvedCount: number;
  scores: {
    technical: number;
    onpage: number;
    lighthouse_mobile: number | null;
    lighthouse_desktop: number | null;
  };
  deltas: {
    technical?: number | null;
    onpage?: number | null;
    lighthouse_mobile?: number | null;
    lighthouse_desktop?: number | null;
  };
  topIssues: Array<{
    severity: string;
    title: string;
    page_url: string | null;
  }>;
  dashboardUrl: string | null;
  contactName: string | null;
}

function buildDigestHtml(a: DigestArgs): string {
  const issuesHtml = a.topIssues
    .map(
      (i) => `
      <tr>
        <td style="padding:6px 0;vertical-align:top;width:80px;">
          <span style="display:inline-block;padding:1px 6px;font-size:10px;text-transform:uppercase;background:${severityColor(i.severity)}22;color:${severityColor(i.severity)};border-radius:3px;">${i.severity}</span>
        </td>
        <td style="padding:6px 0;font-size:13px;">
          ${escapeHtml(i.title)}
          ${i.page_url ? `<div style="font-family:ui-monospace,Menlo,monospace;font-size:11px;color:#6B7280;">${escapeHtml(i.page_url)}</div>` : ""}
        </td>
      </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Inter',system-ui,sans-serif;background:#F9FAFB;margin:0;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:white;border-radius:12px;padding:28px;border:1px solid #E5E7EB;">
    <p style="margin:0 0 6px 0;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#6B7280;">Weekly SEO digest</p>
    <h1 style="margin:0 0 4px 0;font-size:22px;color:#111827;">${escapeHtml(a.clientName)}</h1>
    <p style="margin:0 0 20px 0;color:#6B7280;font-size:13px;">${escapeHtml(a.domain)}</p>
    <p style="margin:0 0 18px 0;font-size:14px;color:#111827;">
      Hi${a.contactName ? ` ${escapeHtml(a.contactName)}` : ""}, this week's check found
      <strong>${a.newCount}</strong> new ${a.newCount === 1 ? "issue" : "issues"} of high-or-critical severity${a.resolvedCount > 0 ? `, and resolved <strong>${a.resolvedCount}</strong>` : ""}.
    </p>

    <table style="width:100%;border-collapse:collapse;margin-bottom:18px;">
      <tr>
        <td style="padding:10px;background:#F3F4F6;border-radius:6px;text-align:center;width:25%;">
          <div style="font-size:10px;color:#6B7280;text-transform:uppercase;letter-spacing:0.06em;">Technical</div>
          <div style="font-size:22px;font-weight:600;color:#111827;">${a.scores.technical}${deltaSpan(a.deltas.technical)}</div>
        </td>
        <td style="width:6px;"></td>
        <td style="padding:10px;background:#F3F4F6;border-radius:6px;text-align:center;width:25%;">
          <div style="font-size:10px;color:#6B7280;text-transform:uppercase;letter-spacing:0.06em;">On-page</div>
          <div style="font-size:22px;font-weight:600;color:#111827;">${a.scores.onpage}${deltaSpan(a.deltas.onpage)}</div>
        </td>
        <td style="width:6px;"></td>
        <td style="padding:10px;background:#F3F4F6;border-radius:6px;text-align:center;width:25%;">
          <div style="font-size:10px;color:#6B7280;text-transform:uppercase;letter-spacing:0.06em;">Mobile</div>
          <div style="font-size:22px;font-weight:600;color:#111827;">${a.scores.lighthouse_mobile ?? "n/a"}${deltaSpan(a.deltas.lighthouse_mobile)}</div>
        </td>
        <td style="width:6px;"></td>
        <td style="padding:10px;background:#F3F4F6;border-radius:6px;text-align:center;width:25%;">
          <div style="font-size:10px;color:#6B7280;text-transform:uppercase;letter-spacing:0.06em;">Desktop</div>
          <div style="font-size:22px;font-weight:600;color:#111827;">${a.scores.lighthouse_desktop ?? "n/a"}${deltaSpan(a.deltas.lighthouse_desktop)}</div>
        </td>
      </tr>
    </table>

    ${
      a.topIssues.length > 0
        ? `<h2 style="margin:0 0 8px 0;font-size:13px;color:#111827;text-transform:uppercase;letter-spacing:0.06em;">Top issues</h2>
       <table style="width:100%;border-collapse:collapse;border-top:1px solid #E5E7EB;">${issuesHtml}</table>`
        : ""
    }

    ${
      a.dashboardUrl
        ? `<div style="margin-top:24px;text-align:center;">
        <a href="${a.dashboardUrl}" style="display:inline-block;padding:10px 20px;background:#111827;color:white;text-decoration:none;border-radius:6px;font-size:13px;">View full report &rarr;</a>
      </div>`
        : ""
    }

    <p style="margin:24px 0 0 0;padding-top:16px;border-top:1px solid #E5E7EB;font-size:11px;color:#9CA3AF;text-align:center;">
      Sent by Command Center SEO Agent
    </p>
  </div>
</body></html>`;
}
