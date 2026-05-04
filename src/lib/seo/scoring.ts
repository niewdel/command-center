import type { CrawledPage, PSIMetrics } from "@/lib/audit/types";
import type { CheckScores } from "./types";

// Aggregate scores derived from per-page snapshots + PSI metrics.
//
// Phase 1 keeps these simple — single weighted formulas over the page set.
// Future phases can add weights per page (homepage matters more than a blog
// archive) and trend-aware noise filtering on the diff side, not here.

export function computeScores(
  pages: CrawledPage[],
  psi: PSIMetrics[]
): CheckScores {
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

  // --- Lighthouse mobile (only — we only run mobile in Phase 1) ---
  const lighthouseMobile =
    psi.length > 0
      ? Math.round(
          psi.reduce((sum, p) => sum + p.scores.performance, 0) / psi.length
        )
      : null;

  // Phase 1: only mobile is run. Desktop slot reserved for Phase 2.
  const lighthouseDesktop: number | null = null;

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

  return {
    technical,
    lighthouse_mobile: lighthouseMobile,
    lighthouse_desktop: lighthouseDesktop,
    onpage,
    freshness_days: null, // Phase 2: derive from sitemap lastmod or content_hash diff vs prior check
  };
}
