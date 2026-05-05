// Monthly SEO report executor. Triggered by the monthly_report cron, run as
// fire-and-forget setImmediate from the cron handler. Mirrors the
// runWeeklyCheck pattern: writes progress to seo_jobs every stage.

import {
  getServiceClient,
  getSeoJob,
  getSeoClient,
  updateSeoJob,
} from "./db";
import { renderMonthlyReportPdf } from "./monthly-report-pdf";
import { sendReportEmail } from "./send-report";
import { generateEmailSummary } from "./claude";
import { getReportData } from "./report-data";
import { signPrintToken } from "./report-print-token";

const REPORTS_BUCKET = "audit-reports"; // reuse existing public bucket

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

  // Use the unified report fetcher — same data shape powers the in-app
  // dashboard. Range is fixed to 30d for the monthly PDF.
  const data = await getReportData(job.client_id, "30d");

  if (data.history.length === 0) {
    await updateSeoJob(jobId, {
      status: "failed",
      error_message: "No seo_checks found. Run a weekly check first.",
      completed_at: new Date().toISOString(),
    });
    return;
  }

  await updateSeoJob(jobId, {
    current_stage: "Rendering report",
    progress_pct: 55,
  });

  // Build the print URL. Token covers (client_id, range, day_bucket) and
  // is valid for the rest of today UTC.
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_URL ??
    "http://localhost:3000";
  const token = signPrintToken(job.client_id, "30d");
  const printUrl = `${baseUrl}/seo/clients/${job.client_id}/report?range=30d&print=1&token=${token}`;

  // Footer template — same per-page footer the prior renderer used.
  const generated = new Date(data.client.generated_at).toLocaleDateString(
    "en-US",
    { month: "short", day: "numeric", year: "numeric" }
  );
  const footerTemplate = `
    <div style="font-size:9px;color:#666;width:100%;padding:0 12mm;display:flex;justify-content:space-between;">
      <span>Delivered by Niewdel · ${generated}</span>
      <span class="pageNumber"></span>/<span class="totalPages"></span>
    </div>
  `;

  await updateSeoJob(jobId, {
    current_stage: "Generating PDF",
    progress_pct: 70,
  });

  const pdfBytes = await renderMonthlyReportPdf(printUrl, { footerTemplate });

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

  const sb = getServiceClient();

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
        period_label: data.client.period_label,
        scores: {
          technical: data.health.technical.current,
          onpage: data.health.onpage.current,
          lighthouse_mobile: data.health.lighthouse_mobile.current,
          lighthouse_desktop: data.health.lighthouse_desktop.current,
        },
        deltas: {
          technical: data.health.technical.delta,
          onpage: data.health.onpage.delta,
          lighthouse_mobile: data.health.lighthouse_mobile.delta,
          lighthouse_desktop: data.health.lighthouse_desktop.delta,
        },
        new_issue_count: data.issues.open_top.length,
        resolved_issue_count: data.issues.resolved.length,
        top_critical_issues: data.issues.open_top.slice(0, 3).map((i) => i.title),
        traffic: data.traffic
          ? {
              sessions: data.traffic.sessions.current,
              organic_sessions: data.traffic.organic_sessions.current,
              users: data.traffic.users.current,
              sessions_delta: data.traffic.sessions.delta,
              organic_sessions_delta: data.traffic.organic_sessions.delta,
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
<p>Your SEO monthly report for ${data.client.period_label} is ready.</p>
<p><a href="${reportUrl}">Download the full PDF report</a></p>`;

    const result = await sendReportEmail({
      workspace_id: job.workspace_id,
      to: email,
      subject: `${client.name}: SEO report for ${data.client.period_label}`,
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
      pdf_bytes: pdfBytes.length,
    },
  });

  log(`Done. Report at ${reportPath}`);
}
