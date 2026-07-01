import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { crawlSite } from "./crawl";
import { runPerformanceAudit } from "./performance";
import { runScoring } from "./scoring";
import { generateHtmlReport } from "./report-html";
import { generateFixPlan } from "./fix-plan";
import { generateFixPlanHtml } from "./report-fix-html";
import type { AuditResult, ScreenshotResult } from "./types";

let serviceClient: SupabaseClient | null = null;
function getServiceClient(): SupabaseClient {
  if (!serviceClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    }
    serviceClient = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return serviceClient;
}

type AuditStatus = "pending" | "crawling" | "scoring" | "rendering" | "complete" | "failed";

interface AuditPatch {
  status?: AuditStatus;
  current_stage?: string;
  progress_pct?: number;
  overall_score?: number;
  overall_severity?: AuditResult["overall_severity"];
  pages_crawled?: number;
  site_name?: string;
  result?: AuditResult;
  report_path?: string;
  fix_plan_path?: string;
  error?: string;
  started_at?: string;
  completed_at?: string;
}

async function patch(auditId: string, p: AuditPatch) {
  const { error } = await getServiceClient().from("audits").update(p).eq("id", auditId);
  if (error) console.error(`[audit ${auditId}] failed to patch:`, error.message);
}

function cleanTitle(raw: string): string {
  return raw
    .split("|")[0]
    .split(" - ")[0]
    .split(" — ")[0]
    .split(" – ")[0]
    .replace(/\b(home\s*page?|welcome|official\s*site)\b/gi, "")
    .trim();
}

export interface RunAuditOptions {
  /** Explicit page cap. Ignored (nav decides the cap) when `mode: "main"`. */
  maxPages?: number;
  /** "main" — crawl the homepage + its primary nav pages (see crawlSite). */
  mode?: "main";
}

export async function runAudit(
  auditId: string,
  rawUrl: string,
  options: RunAuditOptions = { maxPages: 1 },
): Promise<void> {
  const sb = getServiceClient();
  const log = (msg: string) => console.log(`[audit ${auditId}] ${msg}`);
  const { maxPages, mode } = options;

  let url = rawUrl.trim();
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = `https://${url}`;
  }
  const hostname = new URL(url).hostname;

  const stageLabel =
    mode === "main"
      ? "Crawling main pages"
      : maxPages === 1
      ? "Loading page"
      : `Crawling up to ${maxPages} pages`;

  await patch(auditId, {
    status: "crawling",
    current_stage: stageLabel,
    progress_pct: 5,
    started_at: new Date().toISOString(),
  });

  // Phase 1: crawl
  log(`Crawling ${url} (mode=${mode ?? "maxPages"}, maxPages=${maxPages ?? "auto"})`);
  const pages = await crawlSite(
    url,
    (msg, done, total) => {
      // Map crawler progress 0..total → 5..50
      const pct = total > 0 ? 5 + Math.round((done / total) * 45) : 5;
      void patch(auditId, {
        current_stage: msg.length > 80 ? msg.slice(0, 77) + "..." : msg,
        progress_pct: pct,
        pages_crawled: done,
      });
    },
    { maxPages, mode },
  );
  if (pages.length === 0) {
    throw new Error("Crawler returned no pages — site may be unreachable or blocked");
  }
  const psiTargets = [url, ...pages.filter((p) => p.url !== url).slice(0, 4).map((p) => p.url)];
  await patch(auditId, {
    current_stage: `Running performance audit (${psiTargets.length} page${psiTargets.length === 1 ? "" : "s"})`,
    progress_pct: 55,
    pages_crawled: pages.length,
  });

  // Phase 2: PageSpeed Insights — homepage + up to 4 inner pages
  log(`Running PSI on ${psiTargets.length} URL(s)`);
  const psiMetrics = await runPerformanceAudit(psiTargets, (msg) => log(`  [PSI] ${msg}`));
  const screenshots: ScreenshotResult[] = [];

  await patch(auditId, {
    status: "scoring",
    current_stage: "Scoring",
    progress_pct: 80,
  });

  // Phase 3: scoring
  log("Scoring");
  const scoring = await runScoring({ pages, psiMetrics, screenshots, rootUrl: url });

  // Build siteName
  const homePage = pages.find((p) => p.url === url) ?? pages[0];
  const ogSiteName = homePage?.ogTags?.["og:site_name"]?.trim();
  const ogTitle = homePage?.ogTags?.["og:title"]?.trim();
  const pageTitle = homePage?.title?.trim();
  const siteName =
    ogSiteName ||
    (ogTitle ? cleanTitle(ogTitle) : null) ||
    (pageTitle ? cleanTitle(pageTitle) : null) ||
    hostname;

  const auditResult: AuditResult = {
    url,
    siteName,
    auditDate: new Date().toISOString().split("T")[0],
    overall_score: scoring.overall_score,
    overall_severity: scoring.overall_severity,
    overall_headline: scoring.overall_headline,
    overall_narrative: scoring.overall_narrative,
    categories: scoring.categories,
    psiMetrics,
    screenshots: [],
    pagesCrawled: pages.length,
  };

  // Phase 4: render HTML reports
  await patch(auditId, {
    status: "rendering",
    current_stage: "Rendering report",
    progress_pct: 85,
  });

  log("Rendering reports");
  const reportHtml = generateHtmlReport(auditResult);
  const fixPlan = generateFixPlan(auditResult);
  const fixPlanHtml = generateFixPlanHtml(fixPlan);

  // Look up user_id so storage path is scoped per user
  const { data: row } = await sb.from("audits").select("user_id").eq("id", auditId).single();
  const userId = row?.user_id ?? "anon";

  const reportPath = `${userId}/${auditId}-report.html`;
  const fixPath = `${userId}/${auditId}-fix-plan.html`;

  const upReport = await sb.storage
    .from("audit-reports")
    .upload(reportPath, reportHtml, {
      contentType: "text/html; charset=utf-8",
      upsert: true,
    });
  if (upReport.error) throw new Error(`Storage upload (report) failed: ${upReport.error.message}`);

  const upFix = await sb.storage
    .from("audit-reports")
    .upload(fixPath, fixPlanHtml, {
      contentType: "text/html; charset=utf-8",
      upsert: true,
    });
  if (upFix.error) throw new Error(`Storage upload (fix plan) failed: ${upFix.error.message}`);

  await patch(auditId, {
    status: "complete",
    current_stage: "Done",
    progress_pct: 100,
    overall_score: scoring.overall_score,
    overall_severity: scoring.overall_severity,
    site_name: siteName,
    result: auditResult,
    report_path: reportPath,
    fix_plan_path: fixPath,
    completed_at: new Date().toISOString(),
  });

  log(`Complete — score ${scoring.overall_score}/100`);
}
