// src/components/seo/report/leads-section.tsx
//
// Client-facing leads breakdown: booking / contact / call actions counted
// from GA4 and attributed by acquisition channel, plus ad spend and cost
// per lead. Presentational + server-rendered so it works in the PDF.

import type { ReportData, LeadTypeKey } from "@/lib/seo/report-data";
import { Section } from "./section";

const TYPE_LABEL: Record<LeadTypeKey, string> = {
  booking: "Booking clicks",
  contact: "Contact form starts",
  call: "Call clicks",
  email: "Email clicks",
};

// Blue = paid, green = organic, gray = owned/other. One coherent system
// instead of a rainbow, so the channel bars read on-brand at a glance.
const CHANNEL_COLORS: Record<string, string> = {
  // Paid — blue family
  "Paid Search": "#3B86DB",
  "Paid Social": "#5A9BE6",
  "Paid Shopping": "#2D6CC0",
  "Paid Video": "#6FA6E6",
  "Cross-network": "#1B4D8F",
  Display: "#4F92E0",
  // Organic — green family
  "Organic Search": "#35B37E",
  "Organic Social": "#4FC196",
  "Organic Video": "#2A8C63",
  // Owned / other — muted ink
  Direct: "#6B757C",
  Referral: "#8B95A0",
  Email: "#9AA3A8",
  Affiliates: "#5C666D",
};
const FALLBACK = "#3A4046";
const channelColor = (c: string) => CHANNEL_COLORS[c] ?? FALLBACK;

function money(n: number): string {
  return `$${n.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: n < 100 ? 2 : 0,
  })}`;
}

export function LeadsSection({ data }: { data: ReportData }) {
  const leads = data.leads;
  if (!leads) return null;

  const delta =
    leads.prior_total_leads != null && leads.prior_total_leads > 0
      ? Math.round(
          ((leads.total_leads - leads.prior_total_leads) /
            leads.prior_total_leads) *
            100
        )
      : null;

  return (
    <Section title="Leads">
      {/* Top stats */}
      <div className="col-span-12 md:col-span-4 report-card p-6">
        <div className="report-label mb-2">Total Leads</div>
        <div className="text-3xl font-bold text-foreground font-data tabular-nums tracking-tight">
          {leads.total_leads.toLocaleString()}
        </div>
        {delta != null && (
          <div
            className={`text-[11px] mt-1 font-medium font-data tabular-nums ${
              delta >= 0 ? "text-[var(--pos)]" : "text-[var(--neg)]"
            }`}
          >
            {delta >= 0 ? "↑" : "↓"} {Math.abs(delta)}% vs prior {leads.range_days}d
          </div>
        )}
      </div>
      <div className="col-span-12 md:col-span-4 report-card p-6">
        <div className="report-label mb-2">Ad Spend</div>
        <div className="text-3xl font-bold text-foreground font-data tabular-nums tracking-tight">
          {leads.ad_spend != null ? money(leads.ad_spend) : "—"}
        </div>
        <div className="text-[11px] text-muted-foreground mt-1">
          {leads.paid_leads.toLocaleString()} paid lead
          {leads.paid_leads === 1 ? "" : "s"}
        </div>
      </div>
      <div className="col-span-12 md:col-span-4 report-card p-6">
        <div className="report-label mb-2">Cost / Lead</div>
        <div className="text-3xl font-bold text-foreground font-data tabular-nums tracking-tight">
          {leads.cost_per_lead != null ? money(leads.cost_per_lead) : "—"}
        </div>
        <div className="text-[11px] text-muted-foreground mt-1">
          {leads.ad_spend == null ? "ads not linked" : "paid channels only"}
        </div>
      </div>

      {/* By type, with channel bars */}
      <div className="col-span-12 report-card p-6 space-y-4">
        {leads.by_type.map(({ type, total, channels }) => (
          <div key={type} className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-foreground">{TYPE_LABEL[type]}</span>
              <span className="font-bold tabular-nums font-data">
                {total.toLocaleString()}
              </span>
            </div>
            <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted/40">
              {total > 0 &&
                channels.map((s) => (
                  <div
                    key={s.channel}
                    style={{
                      width: `${(s.count / total) * 100}%`,
                      backgroundColor: channelColor(s.channel),
                    }}
                  />
                ))}
            </div>
          </div>
        ))}

        {/* Channel legend */}
        {leads.by_channel.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border pt-4">
            {leads.by_channel.map(({ channel, count }) => {
              const pct =
                leads.total_leads > 0
                  ? Math.round((count / leads.total_leads) * 100)
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
      </div>
    </Section>
  );
}
