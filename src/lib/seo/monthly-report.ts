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
  const email = client.seo_config.contact_email;

  // Dry-run: nothing to send. The in-app /seo/clients/<id>/report IS the preview.
  if (dryRun) {
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

  // Render the full inline-HTML email body.
  const reportHtml = renderMonthlyReportEmail(data, { baseUrl });

  // Prepend the AI prose summary as a greeting block above the report card.
  const FONT = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;";
  const greeting = client.seo_config.contact_name
    ? `Hi ${client.seo_config.contact_name},`
    : "Hi,";

  const introProse = summaryProse
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;">
  <tr>
    <td style="padding:0 32px 0 32px;">
      <p style="${FONT}font-size:14px;color:#0f172a;margin:0 0 8px 0;">${greeting}</p>
      <p style="${FONT}font-size:14px;color:#334155;line-height:1.6;margin:0 0 24px 0;">${summaryProse.replace(/\n\n+/g, '</p><p style="font-size:14px;color:#334155;line-height:1.6;margin:12px 0;">').replace(/\n/g, "<br/>")}</p>
    </td>
  </tr>
</table>`
    : "";

  // Inject intro prose into the email body right after the <body> opening.
  // The renderMonthlyReportEmail output starts with <!doctype html>...<body ...><table...>.
  // We insert the intro block before the outer wrapper table.
  const bodyHtml = introProse
    ? reportHtml.replace(
        /(<body[^>]*>)/,
        `$1\n${introProse}`
      )
    : reportHtml;

  await updateSeoJob(jobId, {
    current_stage: "Sending email",
    progress_pct: 80,
  });

  const result = await sendReportEmail({
    workspace_id: job.workspace_id,
    to: email,
    subject: `${client.name}: SEO report for ${data.client.period_label}`,
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
    },
  });

  log(`Done. email_sent=${emailSent}, via=${emailVia}`);
}
