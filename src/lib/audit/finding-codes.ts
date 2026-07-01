/**
 * Stable finding codes for the audit tool.
 *
 * Every scoring deduction produced by a scorer in `src/lib/audit/scoring/*.ts`
 * must be tagged with one of these codes so findings can be tracked, fixed,
 * and rendered consistently across the report/fix-plan pipeline.
 *
 * This list starts small and grows as each scorer is converted to emit
 * `Finding` objects (see Task 4). Namespaces mirror the scoring categories:
 * seo.*, aeo.*, speed.*, content.*, cta.*, trust.*, conversion.*,
 * usability.*, visual.*
 */
export type FindingCode = string & { readonly __brand: "FindingCode" };

export const FINDING_CODES = [
  "seo.title.missing",
  "seo.title.duplicate",

  // seo.* — additional SEO Fundamentals scorer codes (src/lib/audit/scoring/seo.ts)
  "seo.pages.none",
  "seo.title.coverage.partial",
  "seo.title.duplicate.partial",
  "seo.meta.coverage.partial",
  "seo.meta.coverage.missing",
  "seo.meta.duplicate.partial",
  "seo.meta.duplicate",
  "seo.h1.issues.partial",
  "seo.h1.issues.severe",
  "seo.heading.hierarchy.skipped",
  "seo.image.alt.partial",
  "seo.image.alt.missing",
  "seo.sitemap.missing",
  "seo.canonical.missing",
  "seo.structureddata.missing",
  "seo.opengraph.missing",
  "seo.orphan.pages",
  "seo.title.length",

  // perf.* — Performance & Speed scorer codes (src/lib/audit/scoring/performance.ts)
  "perf.psi.unavailable",
  "perf.lighthouse.needsimprovement",
  "perf.lighthouse.poor",
  "perf.lighthouse.verypoor",
  "perf.lcp.slow",
  "perf.lcp.verypoor",
  "perf.fcp.slow",
  "perf.fcp.verypoor",
  "perf.cls.high",
  "perf.cls.veryhigh",
  "perf.tbt.high",
  "perf.tbt.veryhigh",
  "perf.speedindex.slow",
  "perf.speedindex.veryslow",
  "perf.page.below50",
  "perf.pageweight.high",
  "perf.variance.high",

  // aeo.* — AI-search / answer-engine optimization (src/lib/seo/aeo-score.ts)
  "aeo.schema.absent",
  "aeo.schema.coverage.low",
  "aeo.entity.schema.missing",
  "aeo.faq.absent",
  "aeo.headings.notquestions",
  "aeo.content.notanswerfirst",
  "aeo.llms.absent",
  "aeo.entity.sameas.missing",
  "aeo.nap.inconsistent",
  "aeo.freshness.absent",
  "aeo.aicrawlers.blocked",
  "aeo.headings.structure",
  "aeo.summary.absent",
] as const;

export type KnownCode = (typeof FINDING_CODES)[number];
