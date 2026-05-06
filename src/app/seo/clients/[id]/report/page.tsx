// src/app/seo/clients/[id]/report/page.tsx
//
// Single source of report rendering. Two modes:
//   - Authenticated session: standalone view with range tabs.
//   - ?print=1&token=… : token-validated, no chrome, used by Playwright
//     to generate the monthly PDF.

import { notFound } from "next/navigation";
import {
  getReportData,
  REPORT_RANGES,
  type ReportRange,
} from "@/lib/seo/report-data";
import { verifyPrintToken, verifyViewToken } from "@/lib/seo/report-print-token";
import { ClientReport } from "@/components/seo/report";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function parseRange(input: string | string[] | undefined): ReportRange {
  if (typeof input === "string" && (REPORT_RANGES as string[]).includes(input)) {
    return input as ReportRange;
  }
  return "30d";
}

export default async function ReportPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const range = parseRange(sp.range);

  // Token modes: middleware already let us through; we re-validate here.
  // - print=1 (Playwright/PDF): scoped to (client_id, range, day) — 24h expiry
  // - view=1 (client magic link): scoped to (client_id) — no expiry until secret rotates
  const isPrint = sp.print === "1";
  const isView = sp.view === "1";
  if (isPrint || isView) {
    const token = typeof sp.token === "string" ? sp.token : "";
    const ok = isPrint
      ? verifyPrintToken(id, range, token)
      : verifyViewToken(id, token);
    if (!ok) {
      notFound();
    }
  }

  const data = await getReportData(id, range);

  return (
    <main
      className={
        isPrint
          ? "min-h-dvh bg-background px-10 py-10"
          : "min-h-dvh bg-background px-6 py-8 md:px-10"
      }
    >
      <div className="max-w-6xl mx-auto">
        <ClientReport data={data} mode="standalone" />
      </div>
    </main>
  );
}
