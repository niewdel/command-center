import type { CrawledPage, PSIMetrics } from "@/lib/audit/types";
import type { CheckScores, PageSnapshot } from "./types";
import { computeFreshnessDays } from "./freshness";

// Aggregate scores derived from per-page snapshots + PSI metrics.
//
// Phase 2 adds: lighthouse_desktop (separate PSI run) and freshness_days
// (median age across pages, derived from sitemap lastmod or prior-check
// content_hash diff).

interface FreshnessContext {
  client_id: string;
  rootUrl: string;
  snapshots: PageSnapshot[];
}

export async function computeScores(
  pages: CrawledPage[],
  psiMobile: PSIMetrics[],
  psiDesktop: PSIMetrics[] = [],
  freshnessCtx?: FreshnessContext
): Promise<CheckScores> {
  if (pages.length === 0) {
    return {
      technical: 0,
      lighthouse_mobile: null,
      lighthouse_desktop: null,
      onpage: 0,
      freshness_days: null,
    };
  }

  // --- Technical: status codes + canonical + sitemap discovery ---
  const status2xx = pages.filter((p) => p.statusCode >= 200 && p.statusCode < 300).length;
  const statusFraction = status2xx / pages.length;
  const canonicalPages = pages.filter((p) =>
    p.headLinks.some((l) => l.rel === "canonical")
  ).length;
  const canonicalFraction = canonicalPages / pages.length;
  const technical = Math.round(
    100 * (0.7 * statusFraction + 0.3 * canonicalFraction)
  );

  const lighthouseMobile =
    psiMobile.length > 0
      ? Math.round(
          psiMobile.reduce((sum, p) => sum + p.scores.performance, 0) /
            psiMobile.length
        )
      : null;

  const lighthouseDesktop =
    psiDesktop.length > 0
      ? Math.round(
          psiDesktop.reduce((sum, p) => sum + p.scores.performance, 0) /
            psiDesktop.length
        )
      : null;

  // --- Onpage: weighted completeness across title/meta/h1/alt/schema ---
  const titleOk = pages.filter((p) => {
    const t = p.title.trim();
    return t.length >= 30 && t.length <= 60;
  }).length;
  const metaOk = pages.filter((p) => {
    const m = p.metaDescription.trim();
    return m.length >= 50 && m.length <= 160;
  }).length;
  const h1Ok = pages.filter(
    (p) => p.headings.filter((h) => h.level === 1).length === 1
  ).length;
  const altOkPages = pages.filter((p) => {
    if (p.images.length === 0) return true;
    const missing = p.images.filter(
      (i) => !i.alt || i.alt.trim().length === 0
    ).length;
    return missing / p.images.length <= 0.2;
  }).length;
  const schemaOkPages = pages.filter(
    (p) => p.structuredData && p.structuredData.length > 0
  ).length;

  const onpage = Math.round(
    100 *
      ((0.25 * titleOk +
        0.25 * metaOk +
        0.20 * h1Ok +
        0.15 * altOkPages +
        0.15 * schemaOkPages) /
        pages.length)
  );

  let freshnessDays: number | null = null;
  if (freshnessCtx) {
    try {
      freshnessDays = await computeFreshnessDays(freshnessCtx);
    } catch {
      freshnessDays = null;
    }
  }

  return {
    technical,
    lighthouse_mobile: lighthouseMobile,
    lighthouse_desktop: lighthouseDesktop,
    onpage,
    freshness_days: freshnessDays,
  };
}
