// src/components/seo/report/ads-section.tsx
//
// Mirror of the buildAds() block in monthly-report-email.ts. Three states:
// "ok" renders metrics; "not_configured" / "needs_reconnect" / "error" all
// render the same upsell placeholder so the client only ever sees a
// polished surface.

import type { ReportData } from "@/lib/seo/report-data";
import { Section } from "./section";

function fmtUsd(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

export function AdsSection({ data }: { data: ReportData }) {
  const ads = data.ads;

  if (ads.state === "ok" && ads.metrics) {
    const m = ads.metrics;
    return (
      <Section title="07 · Google Ads">
        <div className="col-span-12 bg-card border border-border rounded-lg p-6">
          <div className="mono-tag-muted mb-2">Spend</div>
          <div className="text-4xl font-bold text-foreground font-data tracking-tight">
            {fmtUsd(m.cost)}
          </div>
          <div className="text-[11px] text-muted-foreground mt-2 font-mono tracking-wider">
            {m.period_start} – {m.period_end}
          </div>
        </div>

        <div className="col-span-12 md:col-span-4 bg-card border border-border rounded-lg p-4">
          <div className="mono-tag-muted mb-1">Clicks</div>
          <div className="text-2xl font-bold text-foreground font-data tabular-nums">
            {m.clicks.toLocaleString()}
          </div>
        </div>
        <div className="col-span-12 md:col-span-4 bg-card border border-border rounded-lg p-4">
          <div className="mono-tag-muted mb-1">Impressions</div>
          <div className="text-2xl font-bold text-foreground font-data tabular-nums">
            {m.impressions.toLocaleString()}
          </div>
        </div>
        <div className="col-span-12 md:col-span-4 bg-card border border-border rounded-lg p-4">
          <div className="mono-tag-muted mb-1">CTR</div>
          <div className="text-2xl font-bold text-foreground font-data tabular-nums">
            {fmtPct(m.ctr)}
          </div>
        </div>

        <div className="col-span-6 bg-card border border-border rounded-lg p-4">
          <div className="mono-tag-muted mb-1">Conversions</div>
          <div className="text-2xl font-bold text-foreground font-data tabular-nums">
            {m.conversions.toFixed(1)}
          </div>
        </div>
        <div className="col-span-6 bg-card border border-border rounded-lg p-4">
          <div className="mono-tag-muted mb-1">
            {m.cost_per_conversion != null ? "Cost / Conversion" : "Avg CPC"}
          </div>
          <div className="text-2xl font-bold text-foreground font-data tabular-nums">
            {m.cost_per_conversion != null
              ? fmtUsd(m.cost_per_conversion)
              : `$${m.avg_cpc.toFixed(2)}`}
          </div>
        </div>

        {m.top_campaigns.length > 0 && (
          <div className="col-span-12 bg-card border border-border rounded-lg p-6">
            <div className="mono-tag-muted mb-3">Top Campaigns</div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left mono-tag-muted pb-2">Campaign</th>
                  <th className="text-right mono-tag-muted pb-2">Spend</th>
                  <th className="text-right mono-tag-muted pb-2">Clicks</th>
                </tr>
              </thead>
              <tbody>
                {m.top_campaigns.map((c) => (
                  <tr key={c.name} className="border-b border-border last:border-0">
                    <td className="py-2 text-sm text-foreground">{c.name}</td>
                    <td className="py-2 text-sm text-foreground tabular-nums text-right font-data">
                      {fmtUsd(c.cost)}
                    </td>
                    <td className="py-2 text-sm text-muted-foreground tabular-nums text-right font-data">
                      {c.clicks.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    );
  }

  // Placeholder / upsell for any non-ok state.
  return (
    <Section title="07 · Google Ads">
      <div className="col-span-12 bg-card border border-dashed border-border rounded-lg p-6">
        <p className="text-base font-bold text-foreground tracking-tight mb-2">
          You're not running paid ads yet.
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-[55ch]">
          Search rankings build over months. Google Ads can drive qualified
          traffic in days. We run campaigns end-to-end: setup, creative,
          bidding, and weekly tuning. Reply if you want a quote.
        </p>
      </div>
    </Section>
  );
}
