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

const SCHEDULES: Array<{ name: string; cron: string; path: string }> = [
  // Sweep orphaned lead jobs every 5 min — tight enough that a stuck
  // pipeline shows up in the UI within a few minutes even without a page
  // visit.
  { name: "sweep-lead-jobs", cron: "*/5 * * * *", path: "/api/cron/sweep-lead-jobs" },
  // Calendar ICS poll — 15 min matches the granularity event consumers
  // actually need.
  { name: "sync-calendars", cron: "*/15 * * * *", path: "/api/cron/sync-calendars" },
  // News refresh hits Claude per topic — keep it hourly to avoid
  // burning budget on duplicates.
  { name: "refresh-news", cron: "0 * * * *", path: "/api/cron/refresh-news" },
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

  globalThis.__ccCronJobs = SCHEDULES.map(({ name, cron, path }) =>
    new Cron(cron, { name, protect: true }, async () => {
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
