// In-process cron scheduler. Runs once when the Next.js server boots and
// fires HTTP POSTs against the local /api/cron/* routes on a schedule.
//
// Why in-process: Railway Functions errored out on create (auth/plan), and
// adding GitHub Actions or a separate Railway service is more infra than
// this single-instance personal app needs. The trade-off is that a process
// crash means the next tick is lost — acceptable for these jobs (the
// on-read sweep covers UX, and the heavy news/calendar jobs catch up on
// the following tick).

import type { Cron as CronType } from "croner";

declare global {
  // eslint-disable-next-line no-var
  var __ccCronJobs: CronType[] | undefined;
}

const SCHEDULES: Array<{
  name: string;
  cron: string;
  path: string;
  timezone?: string;
}> = [
  // Sweep orphaned lead jobs every 5 min — tight enough that a stuck
  // pipeline shows up in the UI within a few minutes even without a page
  // visit.
  { name: "sweep-lead-jobs", cron: "*/5 * * * *", path: "/api/cron/sweep-lead-jobs" },
  // Calendar ICS poll — 15 min matches the granularity event consumers
  // actually need.
  { name: "sync-calendars", cron: "*/15 * * * *", path: "/api/cron/sync-calendars" },
  // SEO weekly check — Mon 09:00 America/New_York. Croner handles DST so
  // this is 9am ET year-round, automatically shifting between EDT and EST.
  {
    name: "seo-weekly-check",
    cron: "0 9 * * 1",
    path: "/api/cron/seo/weekly-check",
    timezone: "America/New_York",
  },
  // SEO sweep — every 15 min. Marks any seo_jobs whose heartbeat is
  // stale (process died mid-run) as failed so the UI moves on.
  { name: "seo-sweep", cron: "*/15 * * * *", path: "/api/cron/seo/sweep" },
  // SEO monthly report — 1st of the month, 09:00 America/New_York.
  // Generates branded PDF + emails to seo_config.contact_email when set.
  {
    name: "seo-monthly-report",
    cron: "0 9 1 * *",
    path: "/api/cron/seo/monthly-report",
    timezone: "America/New_York",
  },
  // SEO paid keyword tracking — Tue 09:00 ET, weekly. Runs DataForSEO SERP
  // for each client.target_keywords. Only fires for clients that opted into
  // paid_tracking_enabled = true in seo_config.
  {
    name: "seo-paid-keyword",
    cron: "0 9 * * 2",
    path: "/api/cron/seo/paid-keyword",
    timezone: "America/New_York",
  },
  // SEO competitor gap analysis — 1st of the month, 09:30 ET. Heavier
  // ranked-keywords API, so monthly cadence only.
  {
    name: "seo-paid-competitor",
    cron: "30 9 1 * *",
    path: "/api/cron/seo/paid-competitor",
    timezone: "America/New_York",
  },
];

export async function register() {
  // Skip on Edge runtime — only the Node.js runtime can run scheduled
  // background work and reach localhost.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Default off in development — enable explicitly with ENABLE_LOCAL_CRON=1
  // when you want to test locally.
  if (
    process.env.NODE_ENV !== "production" &&
    process.env.ENABLE_LOCAL_CRON !== "1"
  ) {
    return;
  }

  // Re-entry guard: instrumentation can re-run on dev server reloads, and
  // we never want duplicate scheduled jobs.
  if (globalThis.__ccCronJobs) {
    for (const j of globalThis.__ccCronJobs) j.stop();
  }

  const { Cron } = await import("croner");
  const port = process.env.PORT ?? "3000";
  const base = `http://127.0.0.1:${port}`;
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    console.warn("[cron] CRON_SECRET not set — cron jobs will not start");
    return;
  }

  globalThis.__ccCronJobs = SCHEDULES.map(({ name, cron, path, timezone }) =>
    new Cron(cron, { name, protect: true, timezone }, async () => {
      const started = Date.now();
      try {
        const res = await fetch(`${base}${path}`, {
          method: "POST",
          headers: {
            "x-cron-secret": secret,
            authorization: `Bearer ${secret}`,
          },
        });
        const body = await res.text();
        const ms = Date.now() - started;
        if (!res.ok) {
          console.error(
            `[cron:${name}] ${res.status} in ${ms}ms — ${body.slice(0, 300)}`
          );
        } else {
          console.log(`[cron:${name}] ok in ${ms}ms — ${body.slice(0, 200)}`);
        }
      } catch (err) {
        const ms = Date.now() - started;
        console.error(`[cron:${name}] threw in ${ms}ms:`, err);
      }
    })
  );

  console.log(
    `[cron] scheduled ${globalThis.__ccCronJobs.length} jobs:`,
    SCHEDULES.map((s) => `${s.name}@${s.cron}`).join(", ")
  );
}
