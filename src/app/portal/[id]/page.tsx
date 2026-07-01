// src/app/portal/[id]/page.tsx
//
// Customer Portal — token-gated, client-facing live reporting surface.
// Public route (see middleware.ts): reachable with ?token=... and no
// Supabase session. Mirrors the standalone SEO report's token model
// (verifyViewToken) but renders its own polished, bare shell rather than
// the operator report layout.

import { notFound } from "next/navigation";
import { getReportData } from "@/lib/seo/report-data";
import { RANGE_LABEL, type ReportRange } from "@/lib/seo/report-types";
import { verifyViewToken } from "@/lib/seo/report-print-token";
import { PortalHeader } from "@/components/portal/PortalHeader";
import { RangeTabs, PORTAL_RANGES } from "@/components/portal/RangeTabs";
import { ScoreHero } from "@/components/portal/ScoreHero";
import { TrafficPanel } from "@/components/portal/TrafficPanel";
import { RankingsPanel } from "@/components/portal/RankingsPanel";
import { LeadsPanel } from "@/components/portal/LeadsPanel";
import { AdsPanel } from "@/components/portal/AdsPanel";
import { WhatWeDid } from "@/components/portal/WhatWeDid";
import { PhotosSection } from "@/components/portal/PhotosSection";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function parseRange(input: string | string[] | undefined): ReportRange {
  if (
    typeof input === "string" &&
    (PORTAL_RANGES as string[]).includes(input)
  ) {
    return input as ReportRange;
  }
  return "30d";
}

export default async function PortalPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const range = parseRange(sp.range);

  const token = typeof sp.token === "string" ? sp.token : "";
  if (!verifyViewToken(id, token)) {
    notFound();
  }

  const data = await getReportData(id, range);

  // "First report" / empty state: nothing has been captured for this client
  // yet (no score history, no traffic, no resolved work to show).
  const isFirstReport =
    data.health.overall_score == null &&
    !data.traffic &&
    data.issues.resolved.length === 0 &&
    data.ads.state === "not_configured";

  return (
    <main className="min-h-dvh bg-background px-6 py-8 md:px-10">
      <div className="max-w-5xl mx-auto">
        <PortalHeader client={data.client} />

        <div className="mb-8">
          <RangeTabs active={range} />
        </div>

        {isFirstReport ? (
          <div className="report-card p-10 text-center">
            <div className="report-eyebrow mb-3">First report in progress</div>
            <h2 className="text-xl font-semibold text-foreground mb-2 text-balance">
              We&apos;re building your first report.
            </h2>
            <p className="text-muted-foreground text-sm text-pretty max-w-md mx-auto">
              Once we finish the first pass on {data.client.domain || "your site"},
              your visibility score, traffic, and rankings will show up here.
              Check back soon.
            </p>
          </div>
        ) : (
          <div className="space-y-12">
            <ScoreHero data={data} />
            <TrafficPanel data={data} />
            <RankingsPanel data={data} />
            <LeadsPanel data={data} />
            <AdsPanel data={data} />
            <WhatWeDid data={data} />
          </div>
        )}

        <div className="mt-12">
          <PhotosSection clientId={id} token={token} />
        </div>

        <footer className="mt-16 pt-6 border-t border-border text-muted-foreground text-xs flex justify-between items-center flex-wrap gap-2">
          <div className="inline-flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-[var(--rust)]" />
            Powered by Niewdel
          </div>
          <div>{RANGE_LABEL[range]}</div>
        </footer>
      </div>
    </main>
  );
}
