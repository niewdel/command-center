import { describe, it, expect } from "vitest";
import {
  wonThisMonth,
  winRate,
  dashboardTopMetrics,
  pipelineByStage,
  dealsCreatedVsClosed,
  activityVolumeByWeek,
  needsAttention,
} from "../dashboard";
import type { CrmActivity, CrmDeal, CrmTask } from "@/types/pipeline";

const NOW = new Date("2026-07-01T12:00:00.000Z");

type MinimalDeal = Pick<CrmDeal, "stage" | "probability" | "value_cents" | "created_at" | "closed_at">;

function deal(overrides: Partial<MinimalDeal>): MinimalDeal {
  return {
    stage: "discovery",
    probability: null,
    value_cents: 100_00,
    created_at: "2026-06-01T00:00:00.000Z",
    closed_at: null,
    ...overrides,
  };
}

describe("wonThisMonth", () => {
  it("counts and sums live deals closed within the calendar month of now", () => {
    const deals: MinimalDeal[] = [
      deal({ stage: "live", closed_at: "2026-07-01T00:00:00.000Z", value_cents: 100_000 }),
      deal({ stage: "live", closed_at: "2026-06-30T23:59:59.000Z", value_cents: 999_999 }), // previous month
      deal({ stage: "lost", closed_at: "2026-07-05T00:00:00.000Z", value_cents: 500_000 }), // not won
      deal({ stage: "live", closed_at: null, value_cents: 200_000 }), // not closed
    ];
    const result = wonThisMonth(deals, NOW);
    expect(result).toEqual({ count: 1, value: 100_000 });
  });

  it("handles no wins", () => {
    expect(wonThisMonth([], NOW)).toEqual({ count: 0, value: 0 });
  });
});

describe("winRate", () => {
  it("computes won / (won + lost) within the window", () => {
    const deals: MinimalDeal[] = [
      deal({ stage: "live", closed_at: "2026-06-20T00:00:00.000Z" }),
      deal({ stage: "live", closed_at: "2026-06-25T00:00:00.000Z" }),
      deal({ stage: "lost", closed_at: "2026-06-28T00:00:00.000Z" }),
      deal({ stage: "disqualified", closed_at: "2026-06-28T00:00:00.000Z" }), // excluded
    ];
    expect(winRate(deals, 90, NOW)).toBeCloseTo(2 / 3);
  });

  it("excludes closed deals outside the window", () => {
    const deals: MinimalDeal[] = [
      deal({ stage: "live", closed_at: "2020-01-01T00:00:00.000Z" }),
      deal({ stage: "lost", closed_at: "2026-06-28T00:00:00.000Z" }),
    ];
    expect(winRate(deals, 90, NOW)).toBe(0);
  });

  it("returns null when nothing closed in the window", () => {
    expect(winRate([deal({ stage: "discovery", closed_at: null })], 90, NOW)).toBeNull();
    expect(winRate([], 90, NOW)).toBeNull();
  });
});

describe("dashboardTopMetrics", () => {
  it("combines open value, weighted forecast, won this month, and win rate", () => {
    const deals: MinimalDeal[] = [
      deal({ stage: "discovery", value_cents: 100_000, probability: null }),
      deal({ stage: "live", value_cents: 200_000, closed_at: "2026-07-01T00:00:00.000Z" }),
      deal({ stage: "lost", value_cents: 50_000, closed_at: "2026-06-15T00:00:00.000Z" }),
    ];
    const metrics = dashboardTopMetrics(deals, NOW);
    expect(metrics.openValue).toBe(100_000);
    expect(metrics.weightedForecast).toBe(10_000); // discovery default 10%
    expect(metrics.wonThisMonth).toEqual({ count: 1, value: 200_000 });
    expect(metrics.winRate).toBeCloseTo(1 / 2);
  });
});

describe("pipelineByStage", () => {
  it("delegates to pipelineForecast's byStage breakdown", () => {
    const deals: MinimalDeal[] = [deal({ stage: "proposal", value_cents: 400_000, probability: null })];
    const byStage = pipelineByStage(deals);
    expect(byStage.proposal.count).toBe(1);
    expect(byStage.proposal.openValue).toBe(400_000);
    expect(byStage.live.count).toBe(0);
  });
});

describe("dealsCreatedVsClosed", () => {
  it("buckets deals into trailing weekly windows, oldest first", () => {
    const deals: Pick<CrmDeal, "created_at" | "closed_at">[] = [
      { created_at: "2026-07-01T00:00:00.000Z", closed_at: null }, // this week
      { created_at: "2026-05-01T00:00:00.000Z", closed_at: "2026-07-01T00:00:00.000Z" }, // created long ago, closed this week
    ];
    const buckets = dealsCreatedVsClosed(deals, 8, NOW);
    expect(buckets).toHaveLength(8);
    expect(buckets[7].created).toBe(1);
    expect(buckets[7].closed).toBe(1);
    // weeks are ascending
    expect(new Date(buckets[0].weekStart).getTime()).toBeLessThan(new Date(buckets[7].weekStart).getTime());
  });

  it("handles an empty deal list", () => {
    const buckets = dealsCreatedVsClosed([], 4, NOW);
    expect(buckets).toHaveLength(4);
    for (const b of buckets) {
      expect(b.created).toBe(0);
      expect(b.closed).toBe(0);
    }
  });
});

describe("activityVolumeByWeek", () => {
  it("buckets activities by week and type", () => {
    const activities: Pick<CrmActivity, "occurred_at" | "type">[] = [
      { occurred_at: "2026-07-01T00:00:00.000Z", type: "call" },
      { occurred_at: "2026-07-01T01:00:00.000Z", type: "call" },
      { occurred_at: "2026-07-01T02:00:00.000Z", type: "email" },
      { occurred_at: "2020-01-01T00:00:00.000Z", type: "note" }, // outside window entirely
    ];
    const buckets = activityVolumeByWeek(activities, 8, NOW);
    const lastWeek = buckets[7];
    expect(lastWeek.byType.call).toBe(2);
    expect(lastWeek.byType.email).toBe(1);
    expect(lastWeek.byType.note).toBe(0);
    expect(lastWeek.total).toBe(3);
    const total = buckets.reduce((sum, b) => sum + b.total, 0);
    expect(total).toBe(3); // the 2020 activity isn't in any bucket
  });
});

describe("needsAttention", () => {
  it("counts stale deals and overdue tasks", () => {
    const deals: Pick<CrmDeal, "stage" | "next_action_at">[] = [
      { stage: "discovery", next_action_at: null },
      { stage: "proposal", next_action_at: "2020-01-01T00:00:00.000Z" },
      { stage: "live", next_action_at: null }, // never stale, closed stage
    ];
    const tasks: Pick<CrmTask, "due_date" | "done">[] = [
      { due_date: "2020-01-01T00:00:00.000Z", done: false },
      { due_date: "2020-01-01T00:00:00.000Z", done: true }, // done, not overdue
      { due_date: null, done: false },
    ];
    expect(needsAttention(deals, tasks, NOW)).toEqual({ staleDeals: 2, overdueTasks: 1 });
  });
});
