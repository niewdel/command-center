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
  const sb = getServiceClient();

  // ── Client row
  const { data: clientRow, error: clientErr } = await sb
    .from("clients")
    .select("id, name, seo_config")
    .eq("id", clientId)
    .single();
  if (clientErr || !clientRow) {
    throw new Error(`Client not found: ${clientId}`);
  }
  const domain = (clientRow.seo_config as { domain?: string } | null)?.domain ?? "";

  // ── Window bounds for time-filtered queries
  const windowMs = rangeWindowMs(range);
  const since = windowMs ? new Date(Date.now() - windowMs).toISOString() : null;

  // ── seo_checks within the window (or all if life)
  let q = sb
    .from("seo_checks")
    .select("id, technical_score, onpage_score, lighthouse_mobile, lighthouse_desktop, freshness_days, pages_crawled, ai_summary, created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (since) q = q.gte("created_at", since);
  const { data: rawChecks } = await q;

  type CheckRow = {
    id: string;
    technical_score: number | null;
    onpage_score: number | null;
    lighthouse_mobile: number | null;
    lighthouse_desktop: number | null;
    freshness_days: number | null;
    pages_crawled: number | null;
    ai_summary: string | null;
    created_at: string;
  };
  const checks = (rawChecks ?? []) as CheckRow[];
  const latest = checks[0] ?? null;
  const earliest = checks[checks.length - 1] ?? null;

  function scoreCard(key: keyof CheckRow): ScoreCard {
    const cur = (latest?.[key] as number | null) ?? null;
    const prior = (earliest?.[key] as number | null) ?? null;
    const history = checks
      .slice()
      .reverse()
      .map((c) => (c[key] as number | null) ?? null)
      .filter((n): n is number => n != null);
    return { current: cur, delta: deltaOrNull(cur, prior), history };
  }

  const technical = scoreCard("technical_score");
  const onpage = scoreCard("onpage_score");
  const lighthouse_mobile = scoreCard("lighthouse_mobile");
  const lighthouse_desktop = scoreCard("lighthouse_desktop");

  // Overall = simple average of non-null current scores. When no scores at
  // all, overall is null.
  const overallNums = [
    technical.current,
    onpage.current,
    lighthouse_mobile.current,
    lighthouse_desktop.current,
  ].filter((n): n is number => n != null);
  const overall_score =
    overallNums.length > 0
      ? Math.round(overallNums.reduce((a, b) => a + b, 0) / overallNums.length)
      : null;
  const priorOverallNums = [
    technical.current != null && technical.delta != null ? technical.current - technical.delta : null,
    onpage.current != null && onpage.delta != null ? onpage.current - onpage.delta : null,
    lighthouse_mobile.current != null && lighthouse_mobile.delta != null ? lighthouse_mobile.current - lighthouse_mobile.delta : null,
    lighthouse_desktop.current != null && lighthouse_desktop.delta != null ? lighthouse_desktop.current - lighthouse_desktop.delta : null,
  ].filter((n): n is number => n != null);
  const prior_overall =
    priorOverallNums.length > 0
      ? Math.round(priorOverallNums.reduce((a, b) => a + b, 0) / priorOverallNums.length)
      : null;
  const overall_delta = deltaOrNull(overall_score, prior_overall);

  // ── Open issues — count by severity (no window; "open" is a current state)
  const { data: openIssuesAll } = await sb
    .from("seo_issues")
    .select("severity, title, page_url, category, status")
    .eq("client_id", clientId)
    .eq("status", "open");
  const openIssues = (openIssuesAll ?? []) as Array<{
    severity: "critical" | "high" | "medium" | "low";
    title: string;
    page_url: string | null;
    category: string;
    status: string;
  }>;
  const open_issues = {
    total: openIssues.length,
    critical: openIssues.filter((i) => i.severity === "critical").length,
    high: openIssues.filter((i) => i.severity === "high").length,
    medium: openIssues.filter((i) => i.severity === "medium").length,
    low: openIssues.filter((i) => i.severity === "low").length,
  };
  const open_top = openIssues
    .filter((i) => i.severity === "critical" || i.severity === "high")
    .sort((a, b) => (a.severity === "critical" ? -1 : 1))
    .slice(0, 10)
    .map((i) => ({
      severity: i.severity,
      title: i.title,
      page_url: i.page_url,
      category: i.category,
    }));

  // ── Resolved in window
  let resolvedQ = sb
    .from("seo_issues")
    .select("title, category")
    .eq("client_id", clientId)
    .eq("status", "fixed");
  if (since) resolvedQ = resolvedQ.gte("resolved_at", since);
  const { data: resolvedRows } = await resolvedQ;
  const resolved = ((resolvedRows ?? []) as Array<{ title: string; category: string }>).map((r) => ({
    title: r.title,
    category: r.category,
  }));

  // ── GA4 traffic snapshots — most recent + prior
  const { data: trafficRows } = await sb
    .from("seo_traffic_snapshots")
    .select(
      "period_start, period_end, sessions, organic_sessions, users, page_views, avg_session_duration_s, bounce_rate, top_pages, top_sources, captured_at"
    )
    .eq("client_id", clientId)
    .order("captured_at", { ascending: false })
    .limit(2);

  type TrafficRow = {
    period_start: string;
    period_end: string;
    sessions: number;
    organic_sessions: number;
    users: number;
    page_views: number;
    avg_session_duration_s: number | null;
    bounce_rate: number | null;
    top_pages: Array<{ path: string; sessions: number; users: number }> | null;
    top_sources: Array<{ source: string; medium: string; sessions: number }> | null;
  };
  const trafficCur = (trafficRows?.[0] ?? null) as TrafficRow | null;
  const trafficPrior = (trafficRows?.[1] ?? null) as TrafficRow | null;

  let traffic: ReportData["traffic"] = null;
  let top_pages: ReportData["top_pages"] = [];

  if (trafficCur) {
    const ppsCurNum =
      trafficCur.sessions > 0 ? trafficCur.page_views / trafficCur.sessions : 0;
    const ppsPriorNum =
      trafficPrior && trafficPrior.sessions > 0
        ? trafficPrior.page_views / trafficPrior.sessions
        : null;

    // Bucket top_sources percentages
    const totals = { search: 0, direct: 0, referral: 0, social: 0, other: 0 };
    let totalSrc = 0;
    for (const s of trafficCur.top_sources ?? []) {
      const bucket = bucketSource(s.medium);
      if (bucket) {
        totals[bucket] += s.sessions;
        totalSrc += s.sessions;
      }
    }
    const sources =
      totalSrc > 0
        ? {
            search: Math.round((totals.search / totalSrc) * 100),
            direct: Math.round((totals.direct / totalSrc) * 100),
            referral: Math.round((totals.referral / totalSrc) * 100),
            social: Math.round((totals.social / totalSrc) * 100),
            other: Math.round((totals.other / totalSrc) * 100),
          }
        : { search: 0, direct: 0, referral: 0, social: 0, other: 0 };

    traffic = {
      sessions: {
        current: trafficCur.sessions,
        delta: deltaOrNull(trafficCur.sessions, trafficPrior?.sessions ?? null),
      },
      organic_sessions: {
        current: trafficCur.organic_sessions,
        delta: deltaOrNull(trafficCur.organic_sessions, trafficPrior?.organic_sessions ?? null),
      },
      users: {
        current: trafficCur.users,
        delta: deltaOrNull(trafficCur.users, trafficPrior?.users ?? null),
      },
      pages_per_session: {
        current: Math.round(ppsCurNum * 100) / 100,
        delta:
          ppsPriorNum != null
            ? Math.round((ppsCurNum - ppsPriorNum) * 100) / 100
            : null,
      },
      sources,
      period_start: trafficCur.period_start,
      period_end: trafficCur.period_end,
    };

    const totalPageSessions = (trafficCur.top_pages ?? []).reduce(
      (a, p) => a + p.sessions,
      0
    );
    top_pages = (trafficCur.top_pages ?? []).slice(0, 5).map((p) => ({
      path: p.path,
      sessions: p.sessions,
      pct_of_total:
        totalPageSessions > 0
          ? Math.round((p.sessions / totalPageSessions) * 100)
          : 0,
    }));
  }

  // ── History for trend chart
  const history = checks
    .slice()
    .reverse()
    .map((c) => ({
      created_at: c.created_at,
      technical_score: c.technical_score,
      onpage_score: c.onpage_score,
      lighthouse_mobile: c.lighthouse_mobile,
      lighthouse_desktop: c.lighthouse_desktop,
    }));

  // ── Period label from the latest check (or now if no checks)
  const periodAnchor = latest ? new Date(latest.created_at) : new Date();
  const period_label = periodAnchor.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return {
    client: {
      id: clientRow.id as string,
      name: clientRow.name as string,
      domain,
      period_label,
      generated_at: new Date().toISOString(),
    },
    range,
    health: {
      overall_score,
      overall_delta,
      technical,
      onpage,
      lighthouse_mobile,
      lighthouse_desktop,
      open_issues,
    },
    traffic,
    keywords: null,   // filled in Task 5
    top_pages,
    issues: { open_top, resolved },
    history,
    ai_summary: latest?.ai_summary ?? null,
  };
}
