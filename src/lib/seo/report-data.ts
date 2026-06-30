// Server-side report data loader. The shape itself + all pure constants
// live in ./report-types so client components can import them without
// dragging this module's service-role / Google OAuth deps into their
// bundle. Re-exported here for backward compat with existing imports.

import { getServiceClient } from "./db";
import { getLeadsSummary } from "./leads";

export type {
  ReportRange,
  ReportData,
  ScoreCard,
  MetricCard,
  KeywordMover,
  ScoreHistoryPoint,
  SeoIssueRowOut,
  SeoResolvedRowOut,
  AdsMetricsView,
  LeadsReportView,
  LeadTypeKey,
} from "./report-types";
export { REPORT_RANGES, RANGE_LABEL } from "./report-types";

import type {
  ReportRange,
  ReportData,
  ScoreCard,
  MetricCard,
  KeywordMover,
  ScoreHistoryPoint,
  SeoIssueRowOut,
  SeoResolvedRowOut,
} from "./report-types";

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
    .select("id, name, workspace_id, seo_config")
    .eq("id", clientId)
    .single();
  if (clientErr || !clientRow) {
    throw new Error(`Client not found: ${clientId}`);
  }
  const seoConfig = (clientRow.seo_config as
    | { domain?: string; google_ads?: { customer_id?: string; enabled?: boolean } }
    | null) ?? null;
  const domain = seoConfig?.domain ?? "";

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

    // Clean the rows before display:
    //   1. Drop "(not set)" — GA noise from bots, blockers, or SPA routes
    //      that fire pageviews before the URL resolves. Always 1-5% of
    //      hits and never useful to surface.
    //   2. Rename "/" to "Home" so clients see a label, not a slash.
    //   3. Recalculate pct_of_total against the cleaned total so the
    //      column adds up after the (not set) row is gone.
    const cleaned = (trafficCur.top_pages ?? []).filter(
      (p) => p.path !== "(not set)" && p.path?.trim() !== "",
    );
    const totalPageSessions = cleaned.reduce((a, p) => a + p.sessions, 0);
    top_pages = cleaned.slice(0, 5).map((p) => ({
      path: p.path === "/" ? "Home" : p.path,
      sessions: p.sessions,
      pct_of_total:
        totalPageSessions > 0
          ? Math.round((p.sessions / totalPageSessions) * 100)
          : 0,
    }));
  }

  // ── Keyword rankings — latest two captures per keyword
  const { data: kwRows } = await sb
    .from("seo_keyword_ranks")
    .select("keyword, rank, search_volume, captured_at")
    .eq("client_id", clientId)
    .order("captured_at", { ascending: false })
    .limit(500);

  type KwRow = {
    keyword: string;
    rank: number | null;
    search_volume: number | null;
    captured_at: string;
  };
  const kwAll = (kwRows ?? []) as KwRow[];

  let keywords: ReportData["keywords"] = null;
  if (kwAll.length > 0) {
    // Group by keyword, keep the two most recent captures.
    const byKeyword = new Map<string, KwRow[]>();
    for (const r of kwAll) {
      const arr = byKeyword.get(r.keyword) ?? [];
      if (arr.length < 2) {
        arr.push(r);
        byKeyword.set(r.keyword, arr);
      }
    }
    const movers: KeywordMover[] = [];
    let totalVolume = 0;
    let rankingCount = 0;
    const ranks: number[] = [];
    for (const [kw, hist] of byKeyword) {
      const cur = hist[0];
      const prior = hist[1] ?? null;
      totalVolume += cur.search_volume ?? 0;
      if (cur.rank != null) {
        rankingCount++;
        ranks.push(cur.rank);
      }
      // Negative delta means rank *improved* (lower is better in SERPs).
      const delta =
        cur.rank != null && prior?.rank != null ? cur.rank - prior.rank : null;
      movers.push({
        keyword: kw,
        rank: cur.rank,
        prior_rank: prior?.rank ?? null,
        delta,
      });
    }
    const movers_up = movers
      .filter((m) => m.delta != null && m.delta < 0)
      .sort((a, b) => (a.delta as number) - (b.delta as number))
      .slice(0, 5);
    const movers_down = movers
      .filter((m) => m.delta != null && m.delta > 0)
      .sort((a, b) => (b.delta as number) - (a.delta as number))
      .slice(0, 5);
    keywords = {
      ranking_count: rankingCount,
      tracked_count: byKeyword.size,
      avg_rank: avg(ranks),
      total_search_volume: totalVolume,
      top_movers_up: movers_up,
      top_movers_down: movers_down,
    };
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

  // ── Google Ads (live fetch, wrapped so a failure here never breaks
  // the report). For clients without a configured customer ID, returns
  // state=not_configured so the report renders the upsell placeholder.
  const ads = await loadAds({
    clientId: clientRow.id as string,
    workspaceId: clientRow.workspace_id as string,
    googleAdsConfig: seoConfig?.google_ads,
    rangeMs: rangeWindowMs(range) ?? 30 * 86_400_000,
  });

  // Leads — booking/contact/call by channel. Isolated like ads so a GA4 or
  // Ads hiccup can't take down the rest of the report. Only surfaced when
  // there's real data to show.
  const rangeDays = range === "90d" ? 90 : range === "life" ? 365 : 30;
  let leads: ReportData["leads"] = null;
  try {
    const summary = await getLeadsSummary(clientId, rangeDays);
    if (summary.configured && summary.total_leads > 0) {
      leads = {
        range_days: summary.range_days,
        total_leads: summary.total_leads,
        prior_total_leads: summary.prior_total_leads,
        by_type: summary.by_type,
        by_channel: summary.by_channel,
        ad_spend: summary.ad_spend,
        paid_leads: summary.paid_leads,
        cost_per_lead: summary.cost_per_lead,
      };
    }
  } catch (err) {
    console.error(
      "[report-data] leads fetch failed:",
      err instanceof Error ? err.message : err
    );
  }

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
    keywords,
    top_pages,
    issues: { open_top, resolved },
    ads,
    leads,
    history,
    ai_summary: latest?.ai_summary ?? null,
  };
}

// ── Google Ads loader, isolated so a misconfigured customer ID or an
// expired token can't take down the rest of the report. ────────────────
async function loadAds(opts: {
  clientId: string;
  workspaceId: string;
  googleAdsConfig?: { customer_id?: string; enabled?: boolean };
  rangeMs: number;
}): Promise<ReportData["ads"]> {
  const customerId = opts.googleAdsConfig?.customer_id?.trim();
  if (!customerId || opts.googleAdsConfig?.enabled === false) {
    return { state: "not_configured", metrics: null };
  }

  // Lazy imports keep the report-data module from forcing Ads helpers into
  // every bundle that touches it.
  const {
    adsConfigured,
    fetchAdsMetrics,
    AdsPermissionError,
    AdsPendingApprovalError,
    AdsNotConfiguredError,
  } = await import("@/lib/google/google-ads");

  if (!adsConfigured()) {
    return { state: "not_configured", metrics: null };
  }

  const { getWorkspaceOwner } = await import("@/lib/seo/db");
  const userId = await getWorkspaceOwner(opts.workspaceId);
  if (!userId) return { state: "not_configured", metrics: null };

  const end = new Date();
  const start = new Date(Date.now() - opts.rangeMs);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  try {
    const metrics = await fetchAdsMetrics({
      userId,
      customerId,
      start: fmt(start),
      end: fmt(end),
    });
    return { state: "ok", metrics };
  } catch (err) {
    if (err instanceof AdsPendingApprovalError) {
      // Pending approval looks like "not_configured" from the client's
      // POV (placeholder card). The operator sees the real state via
      // the ads-status badge on the edit page.
      return { state: "not_configured", metrics: null };
    }
    if (err instanceof AdsPermissionError) {
      return { state: "needs_reconnect", metrics: null };
    }
    if (err instanceof AdsNotConfiguredError) {
      return { state: "not_configured", metrics: null };
    }
    console.error("[google-ads] fetch failed:", err);
    return { state: "error", metrics: null };
  }
}
