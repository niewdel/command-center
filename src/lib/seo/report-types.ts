// Pure types + constants for the SEO report. Zero runtime dependencies.
//
// Lives in its own file so client components (the in-app report
// renderer) can import ReportData / RANGE_LABEL / etc. without pulling
// the server-side data loader's transitive dep chain
// (supabase service-role client, Google OAuth helpers, node:crypto)
// into the client bundle. report-data.ts re-exports from here for
// backward compatibility.

export type ReportRange = "30d" | "60d" | "90d" | "life";

export const REPORT_RANGES: ReportRange[] = ["30d", "60d", "90d", "life"];

export const RANGE_LABEL: Record<ReportRange, string> = {
  "30d": "Last 30 days",
  "60d": "Last 60 days",
  "90d": "Last 90 days",
  life: "Lifetime",
};

export interface ScoreHistoryPoint {
  created_at: string;
  technical_score: number | null;
  onpage_score: number | null;
  lighthouse_mobile: number | null;
  lighthouse_desktop: number | null;
}

export interface ScoreCard {
  current: number | null;
  delta: number | null;
  history: number[];
}

export interface MetricCard {
  current: number;
  delta: number | null;
}

export interface KeywordMover {
  keyword: string;
  rank: number | null;
  prior_rank: number | null;
  delta: number | null;
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

/** Client-safe view of Google Ads metrics. Structurally identical to
 *  AdsMetrics in src/lib/google/google-ads.ts but duplicated here so
 *  client bundles never touch the google-ads module. */
export interface AdsMetricsView {
  period_start: string;
  period_end: string;
  clicks: number;
  impressions: number;
  cost: number;
  ctr: number;
  avg_cpc: number;
  conversions: number;
  cost_per_conversion: number | null;
  top_campaigns: Array<{
    name: string;
    cost: number;
    clicks: number;
    conversions: number;
  }>;
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
    aeo: ScoreCard;
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
  ads: {
    state: "not_configured" | "needs_reconnect" | "error" | "ok";
    metrics: AdsMetricsView | null;
  };
  leads: LeadsReportView | null;
  history: ScoreHistoryPoint[];
  ai_summary: string | null;
}

export type LeadTypeKey = "booking" | "contact" | "call" | "email";

// Client-facing leads view for the report (mirrors lib/seo/leads LeadsSummary,
// but typed here so report-types stays free of server-only deps).
export interface LeadsReportView {
  range_days: number;
  total_leads: number;
  prior_total_leads: number | null;
  by_type: Array<{
    type: LeadTypeKey;
    total: number;
    channels: Array<{ channel: string; count: number }>;
  }>;
  by_channel: Array<{ channel: string; count: number }>;
  ad_spend: number | null;
  paid_leads: number;
  cost_per_lead: number | null;
}
