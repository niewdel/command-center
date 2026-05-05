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
  renderMonthlyReportFooterHtml,
  type MonthlyReportData,
  type ScoreHistoryPoint,
} from "./monthly-report-html";
import { renderMonthlyReportPdf } from "./monthly-report-pdf";
import { sendReportEmail } from "./send-report";
import { generateEmailSummary } from "./claude";

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
      error_message: "No seo_checks found. Run a weekly check first.",
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

  // GA4 traffic snapshots — last 2 (current + prior period for delta).
  // Skipped silently when client has no ga4_property_id or no rows yet.
  const { data: trafficRows } = await sb
    .from("seo_traffic_snapshots")
    .select(
      "period_start, period_end, sessions, organic_sessions, users, page_views, avg_session_duration_s, bounce_rate, top_pages, top_sources, captured_at"
    )
    .eq("client_id", job.client_id)
    .order("captured_at", { ascending: false })
    .limit(2);

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
    traffic: ((): MonthlyReportData["traffic"] => {
      const rows = trafficRows ?? [];
      if (rows.length === 0) return null;
      const cur = rows[0] as {
        period_start: string;
        period_end: string;
        sessions: number;
        organic_sessions: number;
        users: number;
        avg_session_duration_s: number | null;
        bounce_rate: number | null;
        top_pages: Array<{ path: string; sessions: number; users: number }> | null;
        top_sources: Array<{ source: string; medium: string; sessions: number }> | null;
      };
      const prior = (rows[1] as typeof cur | undefined) ?? null;
      const dn = (a: number, b: number | null | undefined): number | null =>
        b == null ? null : a - b;
      return {
        period_start: cur.period_start,
        period_end: cur.period_end,
        sessions: cur.sessions,
        organic_sessions: cur.organic_sessions,
        users: cur.users,
        avg_session_duration_s: cur.avg_session_duration_s ?? 0,
        bounce_rate: cur.bounce_rate ?? 0,
        sessions_delta: dn(cur.sessions, prior?.sessions),
        organic_sessions_delta: dn(cur.organic_sessions, prior?.organic_sessions),
        users_delta: dn(cur.users, prior?.users),
        top_pages: (cur.top_pages ?? []).map((p) => ({
          path: p.path,
          sessions: p.sessions,
        })),
        top_sources: (cur.top_sources ?? []).map((s) => ({
          source: s.source,
          medium: s.medium,
          sessions: s.sessions,
        })),
      };
    })(),
  };

  const html = renderMonthlyReportHtml(data);
  const footerTemplate = renderMonthlyReportFooterHtml(data.generated_at);

  await updateSeoJob(jobId, {
    current_stage: "Generating PDF",
    progress_pct: 70,
  });

  const pdfBytes = await renderMonthlyReportPdf(html, { footerTemplate });

  await updateSeoJob(jobId, {
    current_stage: "Uploading to storage",
    progress_pct: 85,
  });

  // Filename uses the GENERATION timestamp + job id suffix so every run
  // produces a unique file. This avoids browser/CDN caching surprises and
  // lets historical reports be re-opened from "Recent runs" without ever
  // serving a stale render.
  const stamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .slice(0, 19);
  const reportPath = `seo/${job.client_id}/monthly-${stamp}-${jobId.slice(0, 8)}.pdf`;

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
  let emailVia: string | null = null;
  const email = client.seo_config.contact_email;
  const dryRun = client.seo_config.dry_run === true;
  if (email && !dryRun) {
    // Generate a 3-5 sentence client-facing summary covering scores +
    // issues + traffic. Falls back to a minimal body if Claude fails so
    // we never block the email send on the AI step.
    let summaryProse: string | null = null;
    try {
      summaryProse = await generateEmailSummary({
        domain: client.seo_config.domain,
        client_name: client.name,
        contact_name: client.seo_config.contact_name ?? null,
        period_label: data.period_label,
        scores: {
          technical: data.current.technical,
          onpage: data.current.onpage,
          lighthouse_mobile: data.current.lighthouse_mobile,
          lighthouse_desktop: data.current.lighthouse_desktop,
        },
        deltas: data.deltas,
        new_issue_count: data.top_issues.length,
        resolved_issue_count: data.resolved_issues.length,
        top_critical_issues: data.top_issues
          .slice(0, 3)
          .map((i) => i.title),
        traffic: data.traffic
          ? {
              sessions: data.traffic.sessions,
              organic_sessions: data.traffic.organic_sessions,
              users: data.traffic.users,
              sessions_delta: data.traffic.sessions_delta,
              organic_sessions_delta: data.traffic.organic_sessions_delta,
            }
          : null,
      });
    } catch (err) {
      log(
        `Email summary generation failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    const greeting = client.seo_config.contact_name
      ? `Hi ${client.seo_config.contact_name},`
      : "Hi,";
    const bodyHtml = summaryProse
      ? `<p>${greeting}</p>
<p>${summaryProse.replace(/\n\n+/g, "</p><p>").replace(/\n/g, "<br/>")}</p>
<p><a href="${reportUrl}">Download the full PDF report</a></p>`
      : `<p>${greeting}</p>
<p>Your SEO monthly report for ${data.period_label} is ready.</p>
<p><a href="${reportUrl}">Download the full PDF report</a></p>`;

    const result = await sendReportEmail({
      workspace_id: job.workspace_id,
      to: email,
      subject: `${client.name}: SEO report for ${data.period_label}`,
      from_name: "Niewdel",
      html: bodyHtml,
    });
    if (result.ok) {
      emailSent = true;
      emailVia = result.via;
      log(`Emailed report to ${email} via ${result.via}`);
    } else {
      emailError = result.error ?? "send failed";
      log(`Email failed (${result.via}): ${emailError}`);
    }
  }

  await updateSeoJob(jobId, {
    status: "complete",
    progress_pct: 100,
    current_stage: emailSent
      ? `Sent to ${email}`
      : dryRun
        ? "Dry run: report stored, email suppressed"
        : email
          ? `Stored. Email failed: ${emailError ?? "unknown"}`
          : "Stored. No contact_email configured.",
    completed_at: new Date().toISOString(),
    metadata: {
      report_path: reportPath,
      report_url: reportUrl,
      email_sent: emailSent,
      email_via: emailVia,
      email_error: emailError,
      dry_run: dryRun,
      checks_used: checks.length,
      pdf_bytes: pdfBytes.length,
    },
  });

  log(`Done. Report at ${reportPath}`);
}
