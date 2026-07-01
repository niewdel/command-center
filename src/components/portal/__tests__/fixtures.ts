// Shared ReportData fixture builder for portal component tests.
// Not a test file itself (no *.test.ts suffix) so vitest's include glob
// skips it; it's only ever imported by the *.test.tsx files alongside it.

import type { ReportData } from "@/lib/seo/report-types";

export function buildReportData(overrides: Partial<ReportData> = {}): ReportData {
  const base: ReportData = {
    client: {
      id: "client-1",
      name: "Acme Co",
      domain: "acme.com",
      period_label: "Jun 1 – Jun 30",
      generated_at: "2026-06-30T00:00:00.000Z",
    },
    range: "30d",
    health: {
      overall_score: 82,
      overall_delta: 4,
      technical: { current: 90, delta: 2, history: [80, 85, 90] },
      onpage: { current: 78, delta: 1, history: [70, 75, 78] },
      lighthouse_mobile: { current: 88, delta: null, history: [88] },
      lighthouse_desktop: { current: 95, delta: null, history: [95] },
      aeo: { current: 60, delta: 5, history: [50, 55, 60] },
      open_issues: { total: 3, critical: 0, high: 1, medium: 1, low: 1 },
    },
    traffic: {
      sessions: { current: 1200, delta: 100 },
      organic_sessions: { current: 800, delta: 50 },
      users: { current: 900, delta: 40 },
      pages_per_session: { current: 2.4, delta: 0.1 },
      sources: { search: 60, direct: 20, referral: 10, social: 5, other: 5 },
      period_start: "2026-06-01",
      period_end: "2026-06-30",
    },
    keywords: {
      ranking_count: 45,
      tracked_count: 60,
      avg_rank: 12,
      total_search_volume: 15000,
      top_movers_up: [
        { keyword: "seo agency", rank: 4, prior_rank: 9, delta: 5 },
      ],
      top_movers_down: [
        { keyword: "marketing help", rank: 15, prior_rank: 10, delta: -5 },
      ],
    },
    top_pages: [{ path: "/", sessions: 500, pct_of_total: 40 }],
    issues: {
      open_top: [
        {
          severity: "high",
          title: "Missing meta description",
          page_url: "/about",
          category: "onpage",
        },
      ],
      resolved: [
        { title: "Fixed broken checkout link", category: "technical" },
        { title: "Compressed hero images", category: "performance" },
      ],
    },
    ads: {
      state: "ok",
      metrics: {
        period_start: "2026-06-01",
        period_end: "2026-06-30",
        clicks: 340,
        impressions: 12000,
        cost: 875,
        ctr: 0.028,
        avg_cpc: 2.57,
        conversions: 22,
        cost_per_conversion: 39.77,
        top_campaigns: [
          { name: "Brand Search", cost: 500, clicks: 200, conversions: 15 },
        ],
      },
    },
    leads: {
      range_days: 30,
      total_leads: 40,
      prior_total_leads: 32,
      by_type: [
        {
          type: "call",
          total: 20,
          channels: [{ channel: "Paid Search", count: 20 }],
        },
      ],
      by_channel: [{ channel: "Paid Search", count: 20 }],
      ad_spend: 875,
      paid_leads: 20,
      cost_per_lead: 43.75,
    },
    history: [],
    ai_summary: null,
  };

  return { ...base, ...overrides };
}

export function emptyReportData(): ReportData {
  return buildReportData({
    health: {
      overall_score: null,
      overall_delta: null,
      technical: { current: null, delta: null, history: [] },
      onpage: { current: null, delta: null, history: [] },
      lighthouse_mobile: { current: null, delta: null, history: [] },
      lighthouse_desktop: { current: null, delta: null, history: [] },
      aeo: { current: null, delta: null, history: [] },
      open_issues: { total: 0, critical: 0, high: 0, medium: 0, low: 0 },
    },
    traffic: null,
    keywords: null,
    top_pages: [],
    issues: { open_top: [], resolved: [] },
    ads: { state: "not_configured", metrics: null },
    leads: null,
  });
}
