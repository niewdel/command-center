// Leads summary for a SEO client: booking / contact / call / email actions
// attributed by acquisition channel, plus ad spend and cost-per-lead.
//
// Lead COUNTS come entirely from GA4 raw events (consistent across every
// channel, and not dependent on GA4 "key event" configuration). Google Ads
// is used ONLY for spend — we deliberately do NOT use Ads conversion counts,
// which are inflated by Google Business Profile "Local actions" noise.
// Cost-per-lead = ad spend / leads attributed to paid channels.

import { getServiceClient, getWorkspaceOwner } from "./db";
import {
  fetchLeadsByChannel,
  type LeadType,
  type LeadsByChannel,
} from "../google/ga4";
import { fetchAdsMetrics, adsConfigured } from "../google/google-ads";
import type { SeoConfig } from "./types";

export interface LeadsSummary {
  configured: boolean;
  reason?: string;             // why not configured (operator-facing)
  range_days: number;
  start_date: string;
  end_date: string;
  total_leads: number;
  prior_total_leads: number | null;   // same-length window immediately before
  by_type: Array<{
    type: LeadType;
    total: number;
    channels: Array<{ channel: string; count: number }>;
  }>;
  by_channel: Array<{ channel: string; count: number }>;
  ad_spend: number | null;     // null when Ads not configured/available
  paid_leads: number;          // leads attributed to paid channels
  cost_per_lead: number | null;
}

const LEAD_TYPE_ORDER: LeadType[] = ["booking", "contact", "call", "email"];

// GA4 default channel groups that represent paid traffic the Ads spend buys.
function isPaidChannel(channel: string): boolean {
  return (
    channel.startsWith("Paid") ||
    channel === "Cross-network" ||
    channel === "Display"
  );
}

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function empty(
  rangeDays: number,
  start: string,
  end: string,
  reason: string
): LeadsSummary {
  return {
    configured: false,
    reason,
    range_days: rangeDays,
    start_date: start,
    end_date: end,
    total_leads: 0,
    prior_total_leads: null,
    by_type: [],
    by_channel: [],
    ad_spend: null,
    paid_leads: 0,
    cost_per_lead: null,
  };
}

export async function getLeadsSummary(
  clientId: string,
  rangeDays = 30
): Promise<LeadsSummary> {
  // Window ends yesterday (GA4's last fully-processed day).
  const end = new Date();
  end.setUTCDate(end.getUTCDate() - 1);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (rangeDays - 1));
  const priorEnd = new Date(start);
  priorEnd.setUTCDate(priorEnd.getUTCDate() - 1);
  const priorStart = new Date(priorEnd);
  priorStart.setUTCDate(priorStart.getUTCDate() - (rangeDays - 1));
  const startStr = fmtDate(start);
  const endStr = fmtDate(end);

  const sb = getServiceClient();
  const { data: client } = await sb
    .from("clients")
    .select("workspace_id, seo_config")
    .eq("id", clientId)
    .maybeSingle();

  if (!client) return empty(rangeDays, startStr, endStr, "Client not found");

  const cfg = client.seo_config as SeoConfig | null;
  const propertyId = cfg?.ga4_property_id?.trim();
  const leadEvents = cfg?.lead_events;
  if (!propertyId) {
    return empty(rangeDays, startStr, endStr, "No GA4 property connected");
  }
  const hasEvents =
    !!leadEvents &&
    Object.values(leadEvents).some((arr) => (arr?.length ?? 0) > 0);
  if (!hasEvents) {
    return empty(
      rangeDays,
      startStr,
      endStr,
      "No lead events mapped for this client"
    );
  }

  const userId = await getWorkspaceOwner(client.workspace_id as string);
  if (!userId) {
    return empty(rangeDays, startStr, endStr, "No workspace owner");
  }

  // GA4: current + prior window in parallel. Prior is best-effort.
  const [cur, prior] = await Promise.all([
    fetchLeadsByChannel({
      user_id: userId,
      property_id: propertyId,
      lead_events: leadEvents!,
      start_date: startStr,
      end_date: endStr,
    }),
    fetchLeadsByChannel({
      user_id: userId,
      property_id: propertyId,
      lead_events: leadEvents!,
      start_date: fmtDate(priorStart),
      end_date: fmtDate(priorEnd),
    }).catch(() => null as LeadsByChannel | null),
  ]);

  // Ads spend (spend only — never conversion counts).
  let adSpend: number | null = null;
  const adsCustomerId = cfg?.google_ads?.customer_id?.trim();
  if (
    adsCustomerId &&
    cfg?.google_ads?.enabled !== false &&
    adsConfigured()
  ) {
    try {
      const m = await fetchAdsMetrics({
        userId,
        customerId: adsCustomerId,
        start: startStr,
        end: endStr,
      });
      adSpend = m.cost;
    } catch {
      adSpend = null; // pending approval / unlinked — show leads without spend
    }
  }

  const paidLeads = Object.entries(cur.by_channel)
    .filter(([channel]) => isPaidChannel(channel))
    .reduce((sum, [, n]) => sum + n, 0);
  const costPerLead =
    adSpend != null && paidLeads > 0 ? adSpend / paidLeads : null;

  const byType = LEAD_TYPE_ORDER.filter(
    (t) => (leadEvents![t]?.length ?? 0) > 0
  ).map((type) => ({
    type,
    total: cur.by_type[type].total,
    channels: Object.entries(cur.by_type[type].channels)
      .map(([channel, count]) => ({ channel, count }))
      .sort((a, b) => b.count - a.count),
  }));

  const byChannel = Object.entries(cur.by_channel)
    .map(([channel, count]) => ({ channel, count }))
    .sort((a, b) => b.count - a.count);

  return {
    configured: true,
    range_days: rangeDays,
    start_date: startStr,
    end_date: endStr,
    total_leads: cur.total,
    prior_total_leads: prior ? prior.total : null,
    by_type: byType,
    by_channel: byChannel,
    ad_spend: adSpend,
    paid_leads: paidLeads,
    cost_per_lead: costPerLead,
  };
}
