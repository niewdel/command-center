// Google Analytics 4 — Admin + Data API wrappers. Calls the REST endpoints
// directly (no `googleapis` SDK) to keep bundle size small. All calls go
// through getValidAccessToken() so token refresh is automatic.

import { getValidAccessToken } from "./oauth";

const ADMIN_BASE = "https://analyticsadmin.googleapis.com/v1beta";
const DATA_BASE = "https://analyticsdata.googleapis.com/v1beta";

// ============================================================
// Admin API — list accessible GA4 properties
// ============================================================

export interface GA4Property {
  property_id: string;       // numeric id, e.g. "123456789"
  property_name: string;     // display name
  account_id: string;
  account_name: string;
  time_zone?: string;
  currency_code?: string;
}

interface AccountSummariesResponse {
  accountSummaries?: Array<{
    account?: string;
    displayName?: string;
    propertySummaries?: Array<{
      property?: string;       // "properties/123456789"
      displayName?: string;
      propertyType?: string;
    }>;
  }>;
  nextPageToken?: string;
}

export async function listProperties(userId: string): Promise<GA4Property[]> {
  const token = await getValidAccessToken(userId);
  const out: GA4Property[] = [];
  let pageToken: string | undefined;
  do {
    const url = new URL(`${ADMIN_BASE}/accountSummaries`);
    url.searchParams.set("pageSize", "200");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`GA4 listProperties ${res.status}: ${text.slice(0, 300)}`);
    }
    const data = (await res.json()) as AccountSummariesResponse;
    for (const acct of data.accountSummaries ?? []) {
      const accountId = (acct.account ?? "").replace("accounts/", "");
      const accountName = acct.displayName ?? "Unnamed Account";
      for (const prop of acct.propertySummaries ?? []) {
        const propertyId = (prop.property ?? "").replace("properties/", "");
        if (!propertyId) continue;
        out.push({
          property_id: propertyId,
          property_name: prop.displayName ?? "Unnamed Property",
          account_id: accountId,
          account_name: accountName,
        });
      }
    }
    pageToken = data.nextPageToken;
  } while (pageToken);
  return out;
}

// ============================================================
// Data API — runReport for traffic snapshots
// ============================================================

export interface TrafficSnapshot {
  period_start: string;       // ISO date YYYY-MM-DD
  period_end: string;
  sessions: number;
  users: number;
  page_views: number;
  organic_sessions: number;
  avg_session_duration_s: number;
  bounce_rate: number;        // 0-1
  top_pages: Array<{
    path: string;
    sessions: number;
    users: number;
  }>;
  top_sources: Array<{
    source: string;
    medium: string;
    sessions: number;
  }>;
}

interface RunReportResponse {
  rows?: Array<{
    dimensionValues?: Array<{ value?: string }>;
    metricValues?: Array<{ value?: string }>;
  }>;
}

async function runReport(
  token: string,
  propertyId: string,
  body: Record<string, unknown>
): Promise<RunReportResponse> {
  const url = `${DATA_BASE}/properties/${propertyId}:runReport`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`GA4 runReport ${res.status}: ${text.slice(0, 300)}`);
  }
  return (await res.json()) as RunReportResponse;
}

function num(s?: string): number {
  const n = Number(s ?? "0");
  return Number.isFinite(n) ? n : 0;
}

// Pull a traffic snapshot for the given property over a date window.
// Default window: last 7 full days (yesterday-7 to yesterday).
export async function fetchTrafficSnapshot(opts: {
  user_id: string;
  property_id: string;
  start_date?: string; // YYYY-MM-DD or '7daysAgo' / 'yesterday'
  end_date?: string;
}): Promise<TrafficSnapshot> {
  const token = await getValidAccessToken(opts.user_id);
  const dateRange = {
    startDate: opts.start_date ?? "7daysAgo",
    endDate: opts.end_date ?? "yesterday",
  };

  // Run three reports in parallel for the same date range:
  //  1. Top-line totals (sessions, users, page_views, avg duration, bounce)
  //  2. Sessions broken down by traffic source/medium → top_sources
  //  3. Top landing pages by sessions → top_pages
  // Plus a separate metric pull for organic-only sessions.
  const [totals, sources, pages, organic] = await Promise.all([
    runReport(token, opts.property_id, {
      dateRanges: [dateRange],
      metrics: [
        { name: "sessions" },
        { name: "totalUsers" },
        { name: "screenPageViews" },
        { name: "averageSessionDuration" },
        { name: "bounceRate" },
      ],
    }),
    runReport(token, opts.property_id, {
      dateRanges: [dateRange],
      dimensions: [
        { name: "sessionSource" },
        { name: "sessionMedium" },
      ],
      metrics: [{ name: "sessions" }],
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      limit: 10,
    }),
    runReport(token, opts.property_id, {
      dateRanges: [dateRange],
      dimensions: [{ name: "landingPage" }],
      metrics: [
        { name: "sessions" },
        { name: "totalUsers" },
      ],
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      limit: 10,
    }),
    runReport(token, opts.property_id, {
      dateRanges: [dateRange],
      metrics: [{ name: "sessions" }],
      dimensionFilter: {
        filter: {
          fieldName: "sessionMedium",
          stringFilter: { matchType: "EXACT", value: "organic" },
        },
      },
    }),
  ]);

  const totalRow = totals.rows?.[0];
  const sessions = num(totalRow?.metricValues?.[0]?.value);
  const users = num(totalRow?.metricValues?.[1]?.value);
  const pageViews = num(totalRow?.metricValues?.[2]?.value);
  const avgDur = num(totalRow?.metricValues?.[3]?.value);
  const bounce = num(totalRow?.metricValues?.[4]?.value);

  const organicSessions = num(organic.rows?.[0]?.metricValues?.[0]?.value);

  const topSources = (sources.rows ?? []).map((r) => ({
    source: r.dimensionValues?.[0]?.value ?? "(unknown)",
    medium: r.dimensionValues?.[1]?.value ?? "(unknown)",
    sessions: num(r.metricValues?.[0]?.value),
  }));

  const topPages = (pages.rows ?? []).map((r) => ({
    path: r.dimensionValues?.[0]?.value ?? "/",
    sessions: num(r.metricValues?.[0]?.value),
    users: num(r.metricValues?.[1]?.value),
  }));

  // Resolve the actual date window we got back. GA4 echoes 'yesterday' /
  // '7daysAgo' as keywords; we resolve to ISO dates client-side so storage
  // is unambiguous.
  const today = new Date();
  const isoDay = (offset: number) => {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - offset);
    return d.toISOString().slice(0, 10);
  };
  const period_end =
    dateRange.endDate === "yesterday" ? isoDay(1) : dateRange.endDate;
  const period_start =
    dateRange.startDate === "7daysAgo" ? isoDay(7) : dateRange.startDate;

  return {
    period_start,
    period_end,
    sessions,
    users,
    page_views: pageViews,
    organic_sessions: organicSessions,
    avg_session_duration_s: Math.round(avgDur * 100) / 100,
    bounce_rate: Math.round(bounce * 10000) / 10000,
    top_pages: topPages,
    top_sources: topSources,
  };
}

// ============================================================
// Data API — lead events attributed by acquisition channel
// ============================================================

export type LeadType = "booking" | "contact" | "call" | "email";

export interface LeadsByChannel {
  start_date: string;
  end_date: string;
  total: number;
  // Per lead type: total count + count per channel.
  by_type: Record<LeadType, { total: number; channels: Record<string, number> }>;
  // Total leads per channel, across all types.
  by_channel: Record<string, number>;
}

function emptyByType(): LeadsByChannel["by_type"] {
  return {
    booking: { total: 0, channels: {} },
    contact: { total: 0, channels: {} },
    call: { total: 0, channels: {} },
    email: { total: 0, channels: {} },
  };
}

// Count this client's lead events (mapped to types) broken down by GA4's
// default channel grouping, over a date window. Reads raw events directly —
// it does NOT depend on the events being marked as "key events" in the GA4
// property, so attribution works even when conversions aren't configured.
export async function fetchLeadsByChannel(opts: {
  user_id: string;
  property_id: string;
  lead_events: Partial<Record<LeadType, string[]>>;
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
}): Promise<LeadsByChannel> {
  const by_type = emptyByType();
  const by_channel: Record<string, number> = {};

  // Reverse-map every configured event name to its lead type.
  const eventToType = new Map<string, LeadType>();
  const allEvents: string[] = [];
  for (const type of Object.keys(opts.lead_events) as LeadType[]) {
    for (const ev of opts.lead_events[type] ?? []) {
      if (!ev) continue;
      eventToType.set(ev, type);
      allEvents.push(ev);
    }
  }

  const base = {
    start_date: opts.start_date,
    end_date: opts.end_date,
    total: 0,
    by_type,
    by_channel,
  };
  if (allEvents.length === 0) return base;

  const token = await getValidAccessToken(opts.user_id);
  const data = await runReport(token, opts.property_id, {
    dateRanges: [{ startDate: opts.start_date, endDate: opts.end_date }],
    dimensions: [
      { name: "eventName" },
      { name: "sessionDefaultChannelGroup" },
    ],
    metrics: [{ name: "eventCount" }],
    dimensionFilter: {
      filter: {
        fieldName: "eventName",
        inListFilter: { values: allEvents },
      },
    },
    limit: 250,
  });

  let total = 0;
  for (const row of data.rows ?? []) {
    const eventName = row.dimensionValues?.[0]?.value ?? "";
    const channel = row.dimensionValues?.[1]?.value || "(unknown)";
    const count = num(row.metricValues?.[0]?.value);
    const type = eventToType.get(eventName);
    if (!type || count === 0) continue;
    by_type[type].total += count;
    by_type[type].channels[channel] = (by_type[type].channels[channel] ?? 0) + count;
    by_channel[channel] = (by_channel[channel] ?? 0) + count;
    total += count;
  }

  return { ...base, total };
}
