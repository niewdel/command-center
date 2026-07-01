// Monthly SEO report executor. Triggered by the monthly_report cron, run as
// fire-and-forget setImmediate from the cron handler. Mirrors the
// runWeeklyCheck pattern: writes progress to seo_jobs every stage.
//
// Flow:
//   1. Load 30-day report data via getReportData()
//   2. If no history → fail (no checks run yet)
//   3. If dry_run → mark complete with preview URL in stage message
//   4. If no contact_email → mark complete noting email suppressed
//   5. Otherwise: generate AI email summary, render HTML email body, send

import {
  getSeoJob,
  getSeoClient,
  updateSeoJob,
} from "./db";
import { renderMonthlyReportEmail } from "./monthly-report-email";
import { sendReportEmail } from "./send-report";
import { generateEmailSummary } from "./claude";
import { getReportData } from "./report-data";

export async function runMonthlyReport(
  jobId: string,
  options: { overrideEmail?: string } = {}
): Promise<void> {
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
  // dashboard. Range is fixed to 30d for the monthly email.
  const data = await getReportData(job.client_id, "30d");

  if (data.history.length === 0) {
    await updateSeoJob(jobId, {
      status: "failed",
      error_message: "No seo_checks found. Run a weekly check first.",
      completed_at: new Date().toISOString(),
    });
    return;
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_URL ??
    "http://localhost:3000";

  const dryRun = client.seo_config.dry_run === true;
  const email = options.overrideEmail ?? client.seo_config.contact_email;
  const isOverride = !!options.overrideEmail;

  // Dry-run: nothing to send. The in-app /seo/clients/<id>/report IS the preview.
  // An explicit overrideEmail (manual "Email preview" button) bypasses dry-run
  // because the recipient is the operator, not the client.
  if (dryRun && !isOverride) {
    const previewUrl = `${baseUrl}/seo/clients/${job.client_id}/report?range=30d`;
    await updateSeoJob(jobId, {
      status: "complete",
      progress_pct: 100,
      current_stage: `Dry run: nothing sent (preview at /seo/clients/${job.client_id}/report)`,
      completed_at: new Date().toISOString(),
      metadata: {
        email_sent: false,
        email_via: null,
        email_error: null,
        dry_run: true,
        preview_url: previewUrl,
      },
    });
    log(`Dry-run complete. Preview: ${previewUrl}`);
    return;
  }

  // No contact_email: skip send.
  if (!email) {
    await updateSeoJob(jobId, {
      status: "complete",
      progress_pct: 100,
      current_stage: "No contact_email configured",
      completed_at: new Date().toISOString(),
      metadata: {
        email_sent: false,
        email_via: null,
        email_error: null,
        dry_run: false,
      },
    });
    log("No contact_email — skipped send.");
    return;
  }

  await updateSeoJob(jobId, {
    current_stage: "Generating email content",
    progress_pct: 40,
  });

  // Generate a 3-5 sentence client-facing prose summary. This becomes a brief
  // intro paragraph above the structured report in the email body. Falls back
  // to null if Claude fails so we never block the email send on the AI step.
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

  await updateSeoJob(jobId, {
    current_stage: "Rendering email",
    progress_pct: 60,
  });

  // The plain-English summary goes at the END of the report (the "In plain
  // English" section rendered by buildAiSummary), not as a long intro block up
  // top. Prefer the freshly generated prose; fall back to any summary the data
  // loader already attached.
  if (summaryProse) {
    data.ai_summary = summaryProse;
  }

  // Render the full inline-HTML email body. No leading intro block — the data
  // (score, visitors, pages, rankings) leads; the summary closes.
  const bodyHtml = renderMonthlyReportEmail(data, { baseUrl });

  await updateSeoJob(jobId, {
    current_stage: "Sending email",
    progress_pct: 80,
  });

  const subjectPrefix = isOverride ? "[Preview] " : "";
  // Extra client-side recipients (CC). Skipped on operator previews so a preview
  // never reaches the client's team.
  const cc =
    !isOverride && Array.isArray(client.seo_config.report_cc)
      ? client.seo_config.report_cc.filter((a) => !!a && a !== email)
      : undefined;
  const result = await sendReportEmail({
    workspace_id: job.workspace_id,
    to: email,
    cc,
    subject: `${subjectPrefix}${client.name}: Visibility report for ${data.client.period_label}`,
    from_name: "Niewdel",
    html: bodyHtml,
  });

  let emailSent = false;
  let emailError: string | null = null;
  let emailVia: string | null = null;

  if (result.ok) {
    emailSent = true;
    emailVia = result.via;
    log(`Emailed report to ${email} via ${result.via}`);
  } else {
    emailError = result.error ?? "send failed";
    log(`Email failed (${result.via}): ${emailError}`);
  }

  await updateSeoJob(jobId, {
    status: "complete",
    progress_pct: 100,
    current_stage: emailSent
      ? `Sent to ${email}`
      : `Email failed: ${emailError ?? "unknown"}`,
    completed_at: new Date().toISOString(),
    metadata: {
      email_sent: emailSent,
      email_via: emailVia,
      email_error: emailError,
      dry_run: false,
      preview: isOverride,
    },
  });

  log(`Done. email_sent=${emailSent}, via=${emailVia}, preview=${isOverride}`);
}
