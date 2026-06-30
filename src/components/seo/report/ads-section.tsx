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
      <Section title="Google Ads">
        <div className="col-span-12 report-card p-6">
          <div className="report-label mb-2">Spend</div>
          <div className="text-4xl font-bold text-foreground font-data tracking-tight">
            {fmtUsd(m.cost)}
          </div>
          <div className="text-[11px] text-muted-foreground mt-2 font-data tracking-wider">
            {m.period_start} – {m.period_end}
          </div>
        </div>

        <div className="col-span-12 md:col-span-4 report-card p-6">
          <div className="report-label mb-1">Clicks</div>
          <div className="text-2xl font-bold text-foreground font-data tabular-nums">
            {m.clicks.toLocaleString()}
          </div>
        </div>
        <div className="col-span-12 md:col-span-4 report-card p-6">
          <div className="report-label mb-1">Impressions</div>
          <div className="text-2xl font-bold text-foreground font-data tabular-nums">
            {m.impressions.toLocaleString()}
          </div>
        </div>
        <div className="col-span-12 md:col-span-4 report-card p-6">
          <div className="report-label mb-1">CTR</div>
          <div className="text-2xl font-bold text-foreground font-data tabular-nums">
            {fmtPct(m.ctr)}
          </div>
        </div>

        <div className="col-span-6 report-card p-6">
          <div className="report-label mb-1">Conversions</div>
          <div className="text-2xl font-bold text-foreground font-data tabular-nums">
            {m.conversions.toFixed(1)}
          </div>
        </div>
        <div className="col-span-6 report-card p-6">
          <div className="report-label mb-1">
            {m.cost_per_conversion != null ? "Cost / Conversion" : "Avg CPC"}
          </div>
          <div className="text-2xl font-bold text-foreground font-data tabular-nums">
            {m.cost_per_conversion != null
              ? fmtUsd(m.cost_per_conversion)
              : `$${m.avg_cpc.toFixed(2)}`}
          </div>
        </div>

        {m.top_campaigns.length > 0 && (
          <div className="col-span-12 report-card p-6">
            <div className="report-label mb-3">Top Campaigns</div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left report-label pb-2">Campaign</th>
                  <th className="text-right report-label pb-2">Spend</th>
                  <th className="text-right report-label pb-2">Clicks</th>
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

  // Placeholder for any non-ok state. Niewdel does not run ad campaigns,
  // we only report on existing ones, so the CTA asks the client to grant
  // us manager access rather than offering campaign management.
  return (
    <Section title="Google Ads">
      <div className="col-span-12 report-card p-6 border-dashed">
        <p className="text-base font-bold text-foreground tracking-tight mb-2">
          Link your Google Ads.
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-[60ch]">
          If you run Google Ads campaigns and want the performance included
          here each month, add Niewdel as a manager on your Google Ads
          account. We don&apos;t run the campaigns, we just pull the data
          for your monthly report. Reply if you&apos;d like to set it up.
        </p>
      </div>
    </Section>
  );
}
