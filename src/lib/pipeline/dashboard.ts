import { ACTIVITY_TYPES, type ActivityType, type CrmActivity, type CrmDeal } from "@/types/pipeline";
import { pipelineForecast, type PipelineForecast } from "./forecast";
import { isDealStale } from "./stale";
import { isTaskOverdue } from "./tasks";

/**
 * Reporting dashboard aggregation (Task E6). Every function here is pure —
 * it takes plain deal/activity/task rows and `now`, and returns numbers or
 * buckets. The page fetches workspace-scoped rows and passes them in; none
 * of this touches Supabase, so it's fully unit-testable.
 */

// ---------------------------------------------------------------------------
// Top metrics row
// ---------------------------------------------------------------------------

export type WonThisMonth = { count: number; value: number };

// All bucketing here is done in UTC — deals/activities are stored as UTC
// timestamps and this runs both server-side and in tests, so anchoring to
// the runtime's local timezone would make "this month" / "this week"
// shift depending on where the code executes.
function startOfDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Deals that reached `live` with a `closed_at` in the calendar month (UTC) of `now`. */
export function wonThisMonth(
  deals: Pick<CrmDeal, "stage" | "closed_at" | "value_cents">[],
  now: Date = new Date()
): WonThisMonth {
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  const won = deals.filter((d) => {
    if (d.stage !== "live" || !d.closed_at) return false;
    const t = new Date(d.closed_at).getTime();
    return t >= monthStart.getTime() && t < nextMonthStart.getTime();
  });

  return {
    count: won.length,
    value: won.reduce((sum, d) => sum + (d.value_cents ?? 0), 0),
  };
}

/**
 * Win rate over a trailing window: won / (won + lost), counting deals whose
 * `closed_at` falls within the last `windowDays`. Deals still open, or
 * disqualified (walked away, not lost), don't count toward the denominator.
 * Returns null when there's nothing closed in the window (no rate to show).
 */
export function winRate(
  deals: Pick<CrmDeal, "stage" | "closed_at">[],
  windowDays = 90,
  now: Date = new Date()
): number | null {
  const windowStart = new Date(startOfDay(now).getTime() - windowDays * 24 * 60 * 60 * 1000);

  const closedInWindow = deals.filter((d) => {
    if (!d.closed_at) return false;
    if (d.stage !== "live" && d.stage !== "lost") return false;
    return new Date(d.closed_at).getTime() >= windowStart.getTime();
  });

  const won = closedInWindow.filter((d) => d.stage === "live").length;
  const lost = closedInWindow.filter((d) => d.stage === "lost").length;
  const total = won + lost;
  if (total === 0) return null;
  return won / total;
}

export type DashboardTopMetrics = {
  openValue: number;
  weightedForecast: number;
  wonThisMonth: WonThisMonth;
  winRate: number | null;
};

/** The four top-row metrics: open pipeline value, weighted forecast, won this month, win rate. */
export function dashboardTopMetrics(
  deals: Pick<CrmDeal, "stage" | "probability" | "value_cents" | "closed_at">[],
  now: Date = new Date()
): DashboardTopMetrics {
  const forecast = pipelineForecast(deals);
  return {
    openValue: forecast.openValue,
    weightedForecast: forecast.weightedValue,
    wonThisMonth: wonThisMonth(deals, now),
    winRate: winRate(deals, 90, now),
  };
}

// ---------------------------------------------------------------------------
// Pipeline value by stage
// ---------------------------------------------------------------------------

/** Re-exported for the dashboard's "value by stage" section — same shape the board header already uses. */
export function pipelineByStage(
  deals: Pick<CrmDeal, "stage" | "probability" | "value_cents">[]
): PipelineForecast["byStage"] {
  return pipelineForecast(deals).byStage;
}

// ---------------------------------------------------------------------------
// Weekly bucketing (created vs closed, activity volume)
// ---------------------------------------------------------------------------

type WeekWindow = { start: Date; end: Date };

/**
 * `weeks` trailing 7-day windows ending "now", oldest first. Each window is
 * `[start, end)` — half-open, so a row lands in exactly one bucket.
 */
function weekWindows(weeks: number, now: Date): WeekWindow[] {
  const todayEnd = new Date(startOfDay(now).getTime() + 24 * 60 * 60 * 1000);
  const windows: WeekWindow[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const end = new Date(todayEnd.getTime() - i * 7 * 24 * 60 * 60 * 1000);
    const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
    windows.push({ start, end });
  }
  return windows;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export type CreatedClosedWeek = { weekStart: string; created: number; closed: number };

/** Deals created vs closed (any closed stage) per trailing week, oldest first. */
export function dealsCreatedVsClosed(
  deals: Pick<CrmDeal, "created_at" | "closed_at">[],
  weeks = 8,
  now: Date = new Date()
): CreatedClosedWeek[] {
  const windows = weekWindows(weeks, now);
  return windows.map(({ start, end }) => {
    const inWindow = (iso: string | null) => {
      if (!iso) return false;
      const t = new Date(iso).getTime();
      return t >= start.getTime() && t < end.getTime();
    };
    return {
      weekStart: isoDate(start),
      created: deals.filter((d) => inWindow(d.created_at)).length,
      closed: deals.filter((d) => inWindow(d.closed_at)).length,
    };
  });
}

export type ActivityWeek = { weekStart: string; byType: Record<ActivityType, number>; total: number };

/** Activity volume per trailing week, broken out by type, oldest first. */
export function activityVolumeByWeek(
  activities: Pick<CrmActivity, "occurred_at" | "type">[],
  weeks = 8,
  now: Date = new Date()
): ActivityWeek[] {
  const windows = weekWindows(weeks, now);
  return windows.map(({ start, end }) => {
    const byType = {} as Record<ActivityType, number>;
    for (const type of ACTIVITY_TYPES) byType[type] = 0;

    let total = 0;
    for (const activity of activities) {
      const t = new Date(activity.occurred_at).getTime();
      if (t >= start.getTime() && t < end.getTime()) {
        byType[activity.type] += 1;
        total += 1;
      }
    }
    return { weekStart: isoDate(start), byType, total };
  });
}

// ---------------------------------------------------------------------------
// Needs attention
// ---------------------------------------------------------------------------

export type NeedsAttention = { staleDeals: number; overdueTasks: number };

/** Count of stale (needs-next-action) deals and overdue open tasks. */
export function needsAttention(
  deals: Parameters<typeof isDealStale>[0][],
  tasks: Parameters<typeof isTaskOverdue>[0][],
  now: Date = new Date()
): NeedsAttention {
  return {
    staleDeals: deals.filter((d) => isDealStale(d, now)).length,
    overdueTasks: tasks.filter((t) => isTaskOverdue(t, now)).length,
  };
}
