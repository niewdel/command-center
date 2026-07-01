// src/components/portal/AdsPanel.tsx
//
// Google Ads panel for the client portal. Centerpiece is the animated
// LiveSpendCounter on a navy hero (matches ScoreHero's treatment); the
// rest of the metrics reuse the same report-card grid pattern as the
// operator report's AdsSection. Placeholder state when ads aren't
// linked/configured/erroring.

import type { ReportData } from "@/lib/seo/report-types";
import { LiveSpendCounter } from "./LiveSpendCounter";

function fmtPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function fmtUsd(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export function AdsPanel({ data }: { data: ReportData }) {
  const ads = data.ads;

  return (
    <section>
      <div className="mb-5">
        <h2 className="report-eyebrow">Your Ads</h2>
        <span className="report-rule mt-2" />
      </div>

      <div className="grid grid-cols-12 gap-3">
        <div className="col-span-12 rounded-[14px] bg-[var(--rust-deep)] p-7">
          <LiveSpendCounter ads={ads} />
        </div>

        {ads.state === "ok" && ads.metrics ? (
          <>
            <div className="col-span-6 md:col-span-3 report-card p-6">
              <div className="report-label mb-1">Clicks</div>
              <div className="text-2xl font-bold text-foreground font-data tabular-nums">
                {ads.metrics.clicks.toLocaleString()}
              </div>
            </div>
            <div className="col-span-6 md:col-span-3 report-card p-6">
              <div className="report-label mb-1">Impressions</div>
              <div className="text-2xl font-bold text-foreground font-data tabular-nums">
                {ads.metrics.impressions.toLocaleString()}
              </div>
            </div>
            <div className="col-span-6 md:col-span-3 report-card p-6">
              <div className="report-label mb-1">CTR</div>
              <div className="text-2xl font-bold text-foreground font-data tabular-nums">
                {fmtPct(ads.metrics.ctr)}
              </div>
            </div>
            <div className="col-span-6 md:col-span-3 report-card p-6">
              <div className="report-label mb-1">Conversions</div>
              <div className="text-2xl font-bold text-foreground font-data tabular-nums">
                {ads.metrics.conversions.toFixed(1)}
              </div>
            </div>
            <div className="col-span-6 report-card p-6">
              <div className="report-label mb-1">
                {ads.metrics.cost_per_conversion != null
                  ? "Cost / Conversion"
                  : "Avg Cost / Click"}
              </div>
              <div className="text-2xl font-bold text-foreground font-data tabular-nums">
                {ads.metrics.cost_per_conversion != null
                  ? fmtUsd(ads.metrics.cost_per_conversion)
                  : fmtUsd(ads.metrics.avg_cpc)}
              </div>
            </div>
            <div className="col-span-6 report-card p-6">
              <div className="report-label mb-1">Total Spend</div>
              <div className="text-2xl font-bold text-foreground font-data tabular-nums">
                {fmtUsd(ads.metrics.cost)}
              </div>
            </div>

            {ads.metrics.top_campaigns.length > 0 && (
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
                    {ads.metrics.top_campaigns.map((c) => (
                      <tr
                        key={c.name}
                        className="border-b border-border last:border-0"
                      >
                        <td className="py-2 text-sm text-foreground">
                          {c.name}
                        </td>
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
          </>
        ) : (
          <div className="col-span-12 report-card p-6 border-dashed">
            <p className="text-base font-bold text-foreground tracking-tight mb-2">
              No ads running yet.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-[60ch]">
              Once your Google Ads account is connected, your spend, clicks,
              and conversions will show up here in real time.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
