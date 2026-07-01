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
] as const;

export type KnownCode = (typeof FINDING_CODES)[number];
