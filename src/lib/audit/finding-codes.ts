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

  // visual.* — Visual Design & Branding scorer codes (src/lib/audit/scoring/visual-design.ts)
  "visual.pages.none",
  "visual.viewport.missing",
  "visual.favicon.missing",
  "visual.fonts.missing",
  "visual.images.homepage.none",
  "visual.images.unique.low",
  "visual.images.responsive.missing",
  "visual.h1.partial",
  "visual.h1.missing",
  "visual.alt.partial",
  "visual.alt.missing",
  "visual.ogimage.missing",
  "visual.imageformats.legacy",
  "visual.brokenimages.minor",
  "visual.brokenimages.severe",

  // usability.* — Usability & Navigation scorer codes (src/lib/audit/scoring/usability.ts)
  "usability.pages.none",
  "usability.nav.semantic.missing",
  "usability.nav.missing",
  "usability.nav.coverage.partial",
  "usability.nav.coverage.missing",
  "usability.clickdepth.partial",
  "usability.clickdepth.severe",
  "usability.brokenlinks.minor",
  "usability.brokenlinks.severe",
  "usability.internallinks.moderate",
  "usability.internallinks.weak",
  "usability.skipnav.missing",
  "usability.a11y.partial",
  "usability.a11y.severe",
  "usability.titles.partial",
  "usability.titles.poor",
  "usability.taptargets.issues",
  "usability.content.jsdependent",

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

  // cta.* — Calls to Action scorer codes (src/lib/audit/scoring/cta.ts)
  "cta.pages.none",
  "cta.homepage.missing",
  "cta.keywords.none",
  "cta.keywords.few",
  "cta.form.pagelinked",
  "cta.form.missing",
  "cta.phone.nothomepage",
  "cta.phone.missing",
  "cta.email.nothomepage",
  "cta.email.missing",
  "cta.paths.partial",
  "cta.paths.single",
  "cta.paths.none",
  "cta.coverage.partial",
  "cta.coverage.missing",
  "cta.contactpage.missing",
  "cta.language.weak",

  // trust.* — Trust & Credibility scorer codes (src/lib/audit/scoring/trust.ts)
  "trust.pages.none",
  "trust.https.missing",
  "trust.privacypolicy.missing",
  "trust.terms.missing",
  "trust.contactpage.missing",
  "trust.address.missing",
  "trust.social.none",
  "trust.social.partial",
  "trust.testimonials.missing",
  "trust.schema.missing",
  "trust.aboutpage.missing",

  // content.* — Content Quality scorer codes (src/lib/audit/scoring/content.ts)
  "content.pages.none",
  "content.homepage.words.moderate",
  "content.homepage.words.thin",
  "content.homepage.words.severelythin",
  "content.avgwords.below",
  "content.avgwords.thin",
  "content.thinpages.one",
  "content.thinpages.many",
  "content.titles.duplicate",
  "content.emptypages.one",
  "content.emptypages.many",
  "content.brokenimages",
  "content.blog.missing",
  "content.freshness.missing",
  "content.ratio.thin",
  "content.meta.thin",
  "content.depth.limited",
] as const;

export type KnownCode = (typeof FINDING_CODES)[number];
