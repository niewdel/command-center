// Operator-only probe of the Google Ads connection for a specific client.
// Returns a coarse state the SEO client edit page can render as a chip,
// so the operator can tell at a glance whether the API is actually
// flowing data or stuck on a config issue / pending approval.
//
// Distinct states:
//   not_configured  no customer ID saved on this client OR env not set
//   needs_reconnect operator's Google connection is missing the adwords scope
//   pending_approval developer token is in test mode (Basic Access not approved yet)
//   error           any other API failure (logged for triage)
//   ok              live data returned, count of campaigns seen included
//
// Never sees the wire to Google when ads aren't configured for the client.

import { NextRequest, NextResponse } from "next/server";
import { getServiceClient, getWorkspaceOwner } from "@/lib/seo/db";
import {
  adsConfigured,
  fetchAdsMetrics,
  AdsNotConfiguredError,
  AdsPermissionError,
  AdsPendingApprovalError,
} from "@/lib/google/google-ads";
import { requireAgencyAdmin } from "@/lib/tenancy";

export const dynamic = "force-dynamic";

type AdsState =
  | "not_configured"
  | "needs_reconnect"
  | "pending_approval"
  | "error"
  | "ok";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireAgencyAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id: clientId } = await params;
  const sb = getServiceClient();

  const { data: client } = await sb
    .from("clients")
    .select("workspace_id, seo_config")
    .eq("id", clientId)
    .maybeSingle();

  if (!client) {
    return NextResponse.json({ state: "not_configured" satisfies AdsState });
  }

  const cfg = (client.seo_config as {
    google_ads?: { customer_id?: string; enabled?: boolean };
  } | null)?.google_ads;
  const customerId = cfg?.customer_id?.trim();
  if (!customerId || cfg?.enabled === false || !adsConfigured()) {
    return NextResponse.json({ state: "not_configured" satisfies AdsState });
  }

  const userId = await getWorkspaceOwner(client.workspace_id as string);
  if (!userId) {
    return NextResponse.json({ state: "not_configured" satisfies AdsState });
  }

  const end = new Date();
  const start = new Date(Date.now() - 30 * 86400000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  try {
    const m = await fetchAdsMetrics({
      userId,
      customerId,
      start: fmt(start),
      end: fmt(end),
    });
    return NextResponse.json({
      state: "ok" satisfies AdsState,
      campaign_count: m.top_campaigns.length,
      cost: m.cost,
    });
  } catch (err) {
    if (err instanceof AdsPendingApprovalError) {
      return NextResponse.json({ state: "pending_approval" satisfies AdsState });
    }
    if (err instanceof AdsPermissionError) {
      return NextResponse.json({ state: "needs_reconnect" satisfies AdsState });
    }
    if (err instanceof AdsNotConfiguredError) {
      return NextResponse.json({ state: "not_configured" satisfies AdsState });
    }
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[ads-status] unexpected:", msg);
    return NextResponse.json({
      state: "error" satisfies AdsState,
      message: msg.slice(0, 200),
    });
  }
}
