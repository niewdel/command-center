"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2, Calendar, FileText, Phone, Mail, TrendingUp, TrendingDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LeadType } from "@/lib/google/ga4";

type LeadsSummary = {
  configured: boolean;
  reason?: string;
  range_days: number;
  start_date: string;
  end_date: string;
  total_leads: number;
  prior_total_leads: number | null;
  by_type: Array<{
    type: LeadType;
    total: number;
    channels: Array<{ channel: string; count: number }>;
  }>;
  by_channel: Array<{ channel: string; count: number }>;
  ad_spend: number | null;
  paid_leads: number;
  cost_per_lead: number | null;
};

const TYPE_META: Record<LeadType, { label: string; icon: typeof Calendar }> = {
  booking: { label: "Booking clicks", icon: Calendar },
  contact: { label: "Contact form starts", icon: FileText },
  call: { label: "Call clicks", icon: Phone },
  email: { label: "Email clicks", icon: Mail },
};

// Consistent, restrained channel palette. Blue family = paid (matches brand
// accent), greens = organic, plus muted hues for the rest.
const CHANNEL_COLORS: Record<string, string> = {
  "Paid Search": "#3B86DB",
  "Paid Social": "#5A9BE6",
  "Paid Shopping": "#2D6CC0",
  "Paid Video": "#6FA6E6",
  "Cross-network": "#1B4D8F",
  Display: "#4F92E0",
  "Organic Search": "#2E9E6B",
  "Organic Social": "#3FA79F",
  "Organic Video": "#4FB58A",
  Direct: "#6B757C",
  Referral: "#B8841A",
  Email: "#9A7BD0",
  Affiliates: "#A06A4A",
};
const FALLBACK = "#3A4046";

function channelColor(channel: string): string {
  return CHANNEL_COLORS[channel] ?? FALLBACK;
}

const RANGES = [
  { key: "30d", label: "30 days" },
  { key: "90d", label: "90 days" },
] as const;

function StackedBar({
  segments,
  total,
}: {
  segments: Array<{ channel: string; count: number }>;
  total: number;
}) {
  if (total <= 0) {
    return <div className="h-2 rounded-full bg-muted/40" />;
  }
  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted/40">
      {segments.map((s) => (
        <div
          key={s.channel}
          title={`${s.channel}: ${s.count}`}
          style={{
            width: `${(s.count / total) * 100}%`,
            backgroundColor: channelColor(s.channel),
          }}
        />
      ))}
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
}) {
  return (
    <div className="px-4 py-3">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold font-heading tabular-nums">
        {value}
      </div>
      {sub && <div className="mt-0.5 text-xs">{sub}</div>}
    </div>
  );
}

export function LeadsPanel({ clientId }: { clientId: string }) {
  const [range, setRange] = useState<"30d" | "90d">("30d");
  const [data, setData] = useState<LeadsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/seo/clients/${clientId}/leads?range=${range}`);
      const json = await res.json();
      setData(res.ok ? json : { configured: false, reason: json.error });
    } catch {
      setData({ configured: false, reason: "Failed to load" } as LeadsSummary);
    } finally {
      setLoading(false);
    }
  }, [clientId, range]);

  useEffect(() => {
    load();
  }, [load]);

  // Header is always shown; body swaps between loading / empty / data.
  const header = (
    <div className="flex items-center justify-between gap-3">
      <div>
        <h2 className="text-sm font-semibold font-heading">Leads</h2>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Booking, contact &amp; call actions by channel · via GA4
        </p>
      </div>
      <div className="flex items-center gap-1 rounded-lg border border-border p-0.5">
        {RANGES.map((r) => (
          <button
            key={r.key}
            onClick={() => setRange(r.key)}
            className={cn(
              "px-2.5 py-1 text-xs rounded-md transition-colors",
              range === r.key
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {r.label}
          </button>
        ))}
      </div>
    </div>
  );

  if (loading && !data) {
    return (
      <Card className="p-5 space-y-4">
        {header}
        <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin mr-2" />
          Loading leads…
        </div>
      </Card>
    );
  }

  if (!data?.configured) {
    return (
      <Card className="p-5 space-y-4">
        {header}
        <p className="text-xs text-muted-foreground py-4">
          {data?.reason ??
            "Connect a GA4 property and map this client's lead events to see attribution."}
        </p>
      </Card>
    );
  }

  const delta =
    data.prior_total_leads != null && data.prior_total_leads > 0
      ? (data.total_leads - data.prior_total_leads) / data.prior_total_leads
      : null;

  // Channels present, in display order (by total desc), for the legend.
  const legendChannels = data.by_channel.map((c) => c.channel);

  const money = (n: number) =>
    `$${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: n < 100 ? 2 : 0 })}`;

  return (
    <Card className="p-5 space-y-5">
      {header}

      {/* Top stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 rounded-lg border border-border divide-y sm:divide-y-0 sm:divide-x divide-border overflow-hidden">
        <Stat
          label="Total leads"
          value={data.total_leads.toLocaleString()}
          sub={
            delta != null ? (
              <span
                className={cn(
                  "inline-flex items-center gap-1 font-medium",
                  delta >= 0 ? "text-emerald-400" : "text-rose-400"
                )}
              >
                {delta >= 0 ? (
                  <TrendingUp className="size-3" />
                ) : (
                  <TrendingDown className="size-3" />
                )}
                {Math.abs(Math.round(delta * 100))}% vs prior {data.range_days}d
              </span>
            ) : (
              <span className="text-muted-foreground">
                prior {data.range_days}d: —
              </span>
            )
          }
        />
        <Stat
          label="Ad spend"
          value={data.ad_spend != null ? money(data.ad_spend) : "—"}
          sub={
            <span className="text-muted-foreground">
              {data.paid_leads.toLocaleString()} paid lead
              {data.paid_leads === 1 ? "" : "s"}
            </span>
          }
        />
        <Stat
          label="Cost per lead"
          value={data.cost_per_lead != null ? money(data.cost_per_lead) : "—"}
          sub={
            <span className="text-muted-foreground">
              {data.ad_spend == null ? "ads not linked" : "paid channels only"}
            </span>
          }
        />
      </div>

      {/* By type, with channel breakdown */}
      <div className="space-y-3.5">
        {data.by_type.map(({ type, total, channels }) => {
          const meta = TYPE_META[type];
          const Icon = meta.icon;
          return (
            <div key={type} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="inline-flex items-center gap-2 text-foreground">
                  <Icon className="size-3.5 text-muted-foreground" />
                  {meta.label}
                </span>
                <span className="font-semibold tabular-nums font-heading">
                  {total.toLocaleString()}
                </span>
              </div>
              <StackedBar segments={channels} total={total} />
            </div>
          );
        })}
      </div>

      {/* Channel legend */}
      {legendChannels.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border pt-3.5">
          {legendChannels.map((channel) => {
            const count =
              data.by_channel.find((c) => c.channel === channel)?.count ?? 0;
            const pct =
              data.total_leads > 0
                ? Math.round((count / data.total_leads) * 100)
                : 0;
            return (
              <span
                key={channel}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
              >
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: channelColor(channel) }}
                />
                {channel}
                <span className="text-foreground tabular-nums">{pct}%</span>
              </span>
            );
          })}
        </div>
      )}
    </Card>
  );
}
