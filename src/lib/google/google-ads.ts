// Google Ads API v18 fetcher.
//
// Authenticates as the operator's MCC (login-customer-id header) and pulls
// campaign performance from a linked sub-account (the customer_id in the
// URL). Returns aggregated metrics for a date range, plus per-campaign
// rows the monthly report can use to call out top performers.
//
// Requires:
//   - GOOGLE_ADS_DEVELOPER_TOKEN: from MCC → Admin → API Center
//   - GOOGLE_ADS_LOGIN_CUSTOMER_ID: the operator's MCC customer ID (no hyphens)
//   - The operator's Google OAuth refresh token must include the
//     'adwords' scope (see ADWORDS_SCOPE in oauth.ts). If the operator
//     authorized BEFORE we added that scope, they need to reconnect.

import { getValidAccessToken } from "./oauth";

const API_VERSION = "v20";
const API_BASE = `https://googleads.googleapis.com/${API_VERSION}`;

export class AdsNotConfiguredError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "AdsNotConfiguredError";
  }
}

export class AdsPermissionError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "AdsPermissionError";
  }
}

/** Distinct from AdsPermissionError: the dev token is correct, the scope is
 *  correct, but Google hasn't approved Basic Access on the developer token
 *  yet. Tokens default to "test mode" which only works against test
 *  accounts. Lets the status badge show "pending approval" vs "needs
 *  reconnect", which mean very different things to the operator. */
export class AdsPendingApprovalError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "AdsPendingApprovalError";
  }
}

export interface AdsMetrics {
  /** Date window queried (YYYY-MM-DD inclusive). */
  period_start: string;
  period_end: string;
  /** Aggregated totals across all enabled campaigns. */
  clicks: number;
  impressions: number;
  /** Spend in dollars (converted from micros). */
  cost: number;
  /** Click-through rate as a fraction (0.05 = 5%). */
  ctr: number;
  /** Average cost per click in dollars. */
  avg_cpc: number;
  /** Conversion count (fractional in Google Ads). */
  conversions: number;
  /** Cost per conversion in dollars, null if zero conversions. */
  cost_per_conversion: number | null;
  /** Active campaigns ranked by spend, capped at 3 for display. */
  top_campaigns: Array<{
    name: string;
    cost: number;
    clicks: number;
    conversions: number;
  }>;
}

interface SearchResponse {
  results?: Array<{
    campaign?: { name?: string; status?: string };
    metrics?: {
      clicks?: string;
      impressions?: string;
      costMicros?: string;
      ctr?: number;
      averageCpc?: string;
      conversions?: number;
    };
  }>;
}

function getEnvOrThrow(): {
  developerToken: string;
  loginCustomerId: string;
} {
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN?.trim();
  const loginCustomerId = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID?.trim();
  if (!developerToken || !loginCustomerId) {
    throw new AdsNotConfiguredError(
      "GOOGLE_ADS_DEVELOPER_TOKEN / GOOGLE_ADS_LOGIN_CUSTOMER_ID not set",
    );
  }
  return { developerToken, loginCustomerId };
}

function microsToDollars(micros: string | number | undefined): number {
  if (micros == null) return 0;
  const n = typeof micros === "string" ? Number(micros) : micros;
  if (!Number.isFinite(n)) return 0;
  return n / 1_000_000;
}

/**
 * Pull aggregated Google Ads metrics for a single sub-account, authenticated
 * as the operator's MCC. `customerId` is the 10-digit account ID without
 * hyphens.
 */
export async function fetchAdsMetrics(opts: {
  userId: string;
  customerId: string;
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD
}): Promise<AdsMetrics> {
  const { developerToken, loginCustomerId } = getEnvOrThrow();
  const accessToken = await getValidAccessToken(opts.userId);

  // Query campaign-level rows for the window. We aggregate in code to keep
  // the GAQL simple and to enable per-campaign callouts in the report.
  const query = `
    SELECT
      campaign.name,
      campaign.status,
      metrics.clicks,
      metrics.impressions,
      metrics.cost_micros,
      metrics.conversions
    FROM campaign
    WHERE segments.date BETWEEN '${opts.start}' AND '${opts.end}'
  `.trim();

  const res = await fetch(
    `${API_BASE}/customers/${opts.customerId}/googleAds:search`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "developer-token": developerToken,
        "login-customer-id": loginCustomerId,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, pageSize: 1000 }),
      signal: AbortSignal.timeout(20_000),
    },
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    // Three distinct failure classes, each implying a different operator
    // action. Order matters: check the most-specific token-not-approved
    // body marker BEFORE the generic 403 branch, since both return 403.
    if (body.includes("DEVELOPER_TOKEN_NOT_APPROVED")) {
      throw new AdsPendingApprovalError(
        "Google Ads developer token is still in test mode. Basic Access approval pending from Google.",
      );
    }
    if (
      res.status === 401 ||
      res.status === 403 ||
      body.includes("PERMISSION_DENIED") ||
      body.includes("invalid_scope")
    ) {
      throw new AdsPermissionError(
        `Google Ads API rejected the request (${res.status}). The operator's Google connection likely needs the 'adwords' scope. Reconnect Google to fix.`,
      );
    }
    throw new Error(`Google Ads ${res.status}: ${body.slice(0, 400)}`);
  }

  const data = (await res.json()) as SearchResponse;
  const rows = data.results ?? [];

  // Aggregate.
  let clicks = 0;
  let impressions = 0;
  let cost = 0;
  let conversions = 0;

  // Per-campaign accumulators for top-3 callout.
  const perCampaign = new Map<
    string,
    { name: string; cost: number; clicks: number; conversions: number }
  >();

  for (const row of rows) {
    const c = Number(row.metrics?.clicks ?? 0);
    const i = Number(row.metrics?.impressions ?? 0);
    const cMicros = microsToDollars(row.metrics?.costMicros);
    const conv = Number(row.metrics?.conversions ?? 0);

    clicks += c;
    impressions += i;
    cost += cMicros;
    conversions += conv;

    const name = row.campaign?.name ?? "(unnamed)";
    const prev =
      perCampaign.get(name) ?? { name, cost: 0, clicks: 0, conversions: 0 };
    prev.cost += cMicros;
    prev.clicks += c;
    prev.conversions += conv;
    perCampaign.set(name, prev);
  }

  const top_campaigns = [...perCampaign.values()]
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 3);

  const ctr = impressions > 0 ? clicks / impressions : 0;
  const avg_cpc = clicks > 0 ? cost / clicks : 0;
  const cost_per_conversion = conversions > 0 ? cost / conversions : null;

  return {
    period_start: opts.start,
    period_end: opts.end,
    clicks,
    impressions,
    cost,
    ctr,
    avg_cpc,
    conversions,
    cost_per_conversion,
    top_campaigns,
  };
}

/**
 * Convenience: check whether Google Ads is configured at all on this
 * server. Lets the report renderer decide between "show data" and "show
 * upsell placeholder" without throwing.
 */
export function adsConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_ADS_DEVELOPER_TOKEN?.trim() &&
      process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID?.trim(),
  );
}
