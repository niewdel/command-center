// Monthly SEO report executor. Triggered by the monthly_report cron, run as
// fire-and-forget setImmediate from the cron handler. Mirrors the
// runWeeklyCheck pattern: writes progress to seo_jobs every stage.

import {
  getServiceClient,
  getSeoJob,
  getSeoClient,
  updateSeoJob,
} from "./db";
import {
  renderMonthlyReportHtml,
  type MonthlyReportData,
  type ScoreHistoryPoint,
} from "./monthly-report-html";
import { renderMonthlyReportPdf } from "./monthly-report-pdf";
import { sendEmail } from "@/lib/email/resend";

const REPORTS_BUCKET = "audit-reports"; // reuse existing public bucket

interface SeoCheckRow {
  id: string;
  technical_score: number | null;
  onpage_score: number | null;
  lighthouse_mobile: number | null;
  lighthouse_desktop: number | null;
  freshness_days: number | null;
  pages_crawled: number | null;
  ai_summary: string | null;
  created_at: string;
}

interface SeoIssueRow {
  severity: "critical" | "high" | "medium" | "low";
  title: string;
  page_url: string | null;
  category: string;
}

interface SeoResolvedRow {
  title: string;
  category: string;
}

function periodLabel(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function deltaOrNull(current: number | null, prior: number | null): number | null {
  if (current == null || prior == null) return null;
  return current - prior;
}

export async function runMonthlyReport(jobId: string): Promise<void> {
  const log = (msg: string) => console.log(`[seo-month ${jobId}] ${msg}`);
  const job = await getSeoJob(jobId);
  if (!job) throw new Error(`SEO job not found: ${jobId}`);
  if (job.type !== "monthly_report") {
    throw new Error(`Expected monthly_report, got ${job.type}`);
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

  await updateSeoJob(jobId, {
    status: "running",
    started_at: new Date().toISOString(),
    current_stage: "Loading 30-day history",
    progress_pct: 10,
  });

  const sb = getServiceClient();

  // Pull last ~6 checks (covers 30+ days at weekly cadence with margin).
  const { data: rawChecks } = await sb
    .from("seo_checks")
    .select(
      "id, technical_score, onpage_score, lighthouse_mobile, lighthouse_desktop, freshness_days, pages_crawled, ai_summary, created_at"
    )
    .eq("client_id", job.client_id)
    .order("created_at", { ascending: false })
    .limit(6);

  const checks = (rawChecks ?? []) as SeoCheckRow[];

  if (checks.length === 0) {
    await updateSeoJob(jobId, {
      status: "failed",
      error_message: "No seo_checks found — run a weekly check first.",
      completed_at: new Date().toISOString(),
    });
    return;
  }

  const latest = checks[0];

  // Find the check closest to 30 days ago for delta computation.
  const thirtyDaysAgo = Date.now() - 30 * 86_400_000;
  const priorCheck =
    checks.find((c) => new Date(c.created_at).getTime() <= thirtyDaysAgo) ??
    checks[checks.length - 1];

  await updateSeoJob(jobId, {
    current_stage: "Loading issues",
    progress_pct: 30,
  });

  // Top open issues (criticals + highs only, up to 10)
  const { data: openIssues } = await sb
    .from("seo_issues")
    .select("severity, title, page_url, category")
    .eq("client_id", job.client_id)
    .eq("status", "open")
    .in("severity", ["critical", "high"])
    .order("severity", { ascending: true })
    .limit(10);

  // Resolved this period
  const periodStart = new Date(latest.created_at);
  periodStart.setDate(periodStart.getDate() - 30);
  const { data: resolved } = await sb
    .from("seo_issues")
    .select("title, category")
    .eq("client_id", job.client_id)
    .eq("status", "fixed")
    .gte("resolved_at", periodStart.toISOString());

  await updateSeoJob(jobId, {
    current_stage: "Rendering report",
    progress_pct: 55,
  });

  const history: ScoreHistoryPoint[] = checks
    .slice()
    .reverse()
    .map((c) => ({
      created_at: c.created_at,
      technical_score: c.technical_score,
      onpage_score: c.onpage_score,
      lighthouse_mobile: c.lighthouse_mobile,
      lighthouse_desktop: c.lighthouse_desktop,
    }));

  const data: MonthlyReportData = {
    client_name: client.name,
    domain: client.seo_config.domain,
    period_label: periodLabel(new Date(latest.created_at)),
    generated_at: new Date().toISOString(),
    current: {
      technical: latest.technical_score,
      onpage: latest.onpage_score,
      lighthouse_mobile: latest.lighthouse_mobile,
      lighthouse_desktop: latest.lighthouse_desktop,
      pages_crawled: latest.pages_crawled,
      freshness_days: latest.freshness_days,
    },
    deltas: {
      technical: deltaOrNull(latest.technical_score, priorCheck.technical_score),
      onpage: deltaOrNull(latest.onpage_score, priorCheck.onpage_score),
      lighthouse_mobile: deltaOrNull(
        latest.lighthouse_mobile,
        priorCheck.lighthouse_mobile
      ),
      lighthouse_desktop: deltaOrNull(
        latest.lighthouse_desktop,
        priorCheck.lighthouse_desktop
      ),
    },
    history,
    top_issues: ((openIssues ?? []) as SeoIssueRow[]).map((i) => ({
      severity: i.severity,
      title: i.title,
      page_url: i.page_url,
      category: i.category,
    })),
    resolved_issues: ((resolved ?? []) as SeoResolvedRow[]).map((i) => ({
      title: i.title,
      category: i.category,
    })),
    ai_summary: latest.ai_summary,
  };

  const html = renderMonthlyReportHtml(data);

  await updateSeoJob(jobId, {
    current_stage: "Generating PDF",
    progress_pct: 70,
  });

  const pdfBytes = await renderMonthlyReportPdf(html);

  await updateSeoJob(jobId, {
    current_stage: "Uploading to storage",
    progress_pct: 85,
  });

  const stamp = new Date(latest.created_at)
    .toISOString()
    .replace(/[:.]/g, "-")
    .slice(0, 19);
  const reportPath = `seo/${job.client_id}/monthly-${stamp}.pdf`;

  const { error: uploadErr } = await sb.storage
    .from(REPORTS_BUCKET)
    .upload(reportPath, pdfBytes, {
      contentType: "application/pdf",
      upsert: true,
    });
  if (uploadErr) throw new Error(`Upload failed: ${uploadErr.message}`);

  const { data: pub } = sb.storage.from(REPORTS_BUCKET).getPublicUrl(reportPath);
  const reportUrl = pub.publicUrl;

  // Email delivery — only if not dry_run AND we have a contact_email.
  let emailSent = false;
  let emailError: string | null = null;
  const email = client.seo_config.contact_email;
  const dryRun = client.seo_config.dry_run === true;
  if (email && !dryRun) {
    try {
      await sendEmail({
        to: email,
        subject: `${client.name} — SEO report for ${data.period_label}`,
        html: `<p>Hi${client.seo_config.contact_name ? ` ${client.seo_config.contact_name}` : ""},</p>
<p>Your SEO monthly report for ${data.period_label} is ready.</p>
<ul>
  <li>Technical: ${latest.technical_score ?? "—"} ${data.deltas.technical != null && data.deltas.technical !== 0 ? `(${data.deltas.technical > 0 ? "+" : ""}${data.deltas.technical})` : ""}</li>
  <li>On-page: ${latest.onpage_score ?? "—"}</li>
  <li>Mobile: ${latest.lighthouse_mobile ?? "—"}</li>
  <li>Desktop: ${latest.lighthouse_desktop ?? "—"}</li>
</ul>
<p><a href="${reportUrl}">Download the full PDF report</a></p>`,
      });
      emailSent = true;
      log(`Emailed report to ${email}`);
    } catch (err) {
      emailError = err instanceof Error ? err.message : String(err);
      log(`Email failed: ${emailError}`);
    }
  }

  await updateSeoJob(jobId, {
    status: "complete",
    progress_pct: 100,
    current_stage: emailSent
      ? `Sent to ${email}`
      : dryRun
        ? "Dry run — report stored, email suppressed"
        : email
          ? `Stored — email failed: ${emailError ?? "unknown"}`
          : "Stored — no contact_email configured",
    completed_at: new Date().toISOString(),
    metadata: {
      report_path: reportPath,
      report_url: reportUrl,
      email_sent: emailSent,
      email_error: emailError,
      dry_run: dryRun,
      checks_used: checks.length,
      pdf_bytes: pdfBytes.length,
    },
  });

  log(`Done — report at ${reportPath}`);
}
