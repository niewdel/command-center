// Single source of report data. Both the in-app dashboard and the monthly
// PDF render from this shape. Sections that depend on optional data
// (traffic snapshots, keyword ranks) return null so the corresponding UI
// section can be omitted entirely instead of showing empty placeholders.

import { getServiceClient } from "./db";
import type { ScoreHistoryPoint } from "./monthly-report-html";

export type ReportRange = "30d" | "90d" | "life";

export const REPORT_RANGES: ReportRange[] = ["30d", "90d", "life"];

export const RANGE_LABEL: Record<ReportRange, string> = {
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  life: "Lifetime",
};

export interface ScoreCard {
  current: number | null;
  delta: number | null;
  history: number[]; // sparkline data, oldest → newest
}

export interface MetricCard {
  current: number;
  delta: number | null;
}

export interface KeywordMover {
  keyword: string;
  rank: number | null;
  prior_rank: number | null;
  delta: number | null; // negative = improvement (rank dropped from 12 to 8)
}

export interface SeoIssueRowOut {
  severity: "critical" | "high" | "medium" | "low";
  title: string;
  page_url: string | null;
  category: string;
}

export interface SeoResolvedRowOut {
  title: string;
  category: string;
}

export interface ReportData {
  client: {
    id: string;
    name: string;
    domain: string;
    period_label: string;
    generated_at: string;
  };
  range: ReportRange;

  health: {
    overall_score: number | null;
    overall_delta: number | null;
    technical: ScoreCard;
    onpage: ScoreCard;
    lighthouse_mobile: ScoreCard;
    lighthouse_desktop: ScoreCard;
    open_issues: {
      total: number;
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
  };

  traffic: {
    sessions: MetricCard;
    organic_sessions: MetricCard;
    users: MetricCard;
    pages_per_session: MetricCard;
    sources: {
      search: number;
      direct: number;
      referral: number;
      social: number;
      other: number;
    };
    period_start: string;
    period_end: string;
  } | null;

  keywords: {
    ranking_count: number;
    tracked_count: number;
    avg_rank: number | null;
    total_search_volume: number;
    top_movers_up: KeywordMover[];
    top_movers_down: KeywordMover[];
  } | null;

  top_pages: Array<{
    path: string;
    sessions: number;
    pct_of_total: number;
  }>;

  issues: {
    open_top: SeoIssueRowOut[];
    resolved: SeoResolvedRowOut[];
  };

  history: ScoreHistoryPoint[];
  ai_summary: string | null;
}

function rangeWindowMs(range: ReportRange): number | null {
  if (range === "30d") return 30 * 86_400_000;
  if (range === "90d") return 90 * 86_400_000;
  return null; // life
}

function deltaOrNull(cur: number | null, prior: number | null): number | null {
  if (cur == null || prior == null) return null;
  return cur - prior;
}

function avg(nums: number[]): number | null {
  const xs = nums.filter((n) => n != null && Number.isFinite(n));
  if (xs.length === 0) return null;
  return Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10;
}

function bucketSource(
  medium: string | null
): "search" | "direct" | "referral" | "social" | "other" | null {
  // GA4 conventional medium values map cleanly here. "(none)" = direct.
  if (!medium) return "other";
  const m = medium.toLowerCase();
  if (m === "organic" || m === "cpc" || m === "ppc") return "search";
  if (m === "(none)" || m === "none" || m === "direct") return "direct";
  if (m === "referral") return "referral";
  if (m === "social" || m === "organic_social" || m === "paid_social")
    return "social";
  return "other";
}

export async function getReportData(
  clientId: string,
  range: ReportRange
): Promise<ReportData> {
  // Filled in over Task 3 + Task 4 + Task 5.
  throw new Error("Not implemented");
}
