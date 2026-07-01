# Audit Tool v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the existing website-audit tool into a sharper internal sales weapon — main-pages crawl by default, a new AEO category, a stable finding-code backbone that guarantees plain-English client findings and a fix-plan that always projects to 100, plus a firm-but-consultative story-arc client report.

**Architecture:** Enhance the existing `src/lib/audit/*` pipeline (crawl → PSI → score → render). The linchpin is replacing free-text `findings: string[]` with `findings: Finding[]` carrying a stable `code`. Two code-keyed dictionaries (`finding-copy.ts` for the client report, `fix-plan.ts` for internal) consume those codes; a test enforces full coverage so nothing is unexplained and the fix-plan always sums to 100.

**AEO is a shared module.** The AEO scoring logic lives once in `src/lib/seo/aeo-score.ts` behind a normalized `AeoInput` interface. Both consumers adapt their own data to `AeoInput`: the **audit tool** (`scoring/aeo.ts` becomes a thin adapter over crawl `CrawledPage[]`) and the recurring **SEO agent** (which gains a first-class AEO health score in the monthly client report). No duplicate AEO logic.

**Tech Stack:** Next.js 16 / React 19 / TypeScript, Playwright (crawl), Google PageSpeed Insights, Anthropic (narratives), Supabase (storage + `audits` table). Add **vitest** for unit tests on the pure scorers.

## Global Constraints

- Design tokens / brand: Jet `#0D0D0D`, Onyx `#1A1A1A`, hairline `#262B2E`, Cloud `#F5F5F5`, Niewdel Blue `#3B86DB`, Navy `#1B4D8F`. Montserrat headings, Inter body. No gradients on app surfaces (reports may mirror the login lockup where explicitly designed).
- Client report shows **findings + business impact only — never a fix or how-to**.
- Internal fix-plan + Claude prompt keep the technical detail and must project to **exactly 100** when all fixes are applied.
- Language in the client report reads at a **5-year-old level**; tone is **firm but consultative**, never insulting.
- Category weights sum to **100**. New AEO category = **12**.
- Audit tool needs no DB migration — categories live in the existing `audits.result` JSONB. (The SEO-agent AEO score in Task 11 may need one `aeo_score` column; decided in that task.)
- Scoring must be **winnable**: no points a well-built site cannot earn.
- TypeScript strict; no `any`. `npx tsc --noEmit` and `npx eslint` must pass at every commit.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/audit/types.ts` | Add `Finding` type; change `CategoryResult.findings` to `Finding[]` |
| `src/lib/audit/finding-codes.ts` | **New** — the `FindingCode` union + the canonical list of all codes |
| `src/lib/audit/scoring/*.ts` | Emit `Finding{code,label,pointsLost}` instead of strings |
| `src/lib/audit/scoring/aeo.ts` | **New** — AEO scorer |
| `src/lib/audit/scoring/index.ts` | Register AEO; rebalance weights to sum 100 |
| `src/lib/audit/discover-main-pages.ts` | **New** — main-nav page discovery |
| `src/lib/audit/crawl.ts` | `"main"` crawl mode; capture AI-crawler robots rules |
| `src/lib/audit/finding-copy.ts` | **New** — `code → { plain, impact }` for the client report |
| `src/lib/audit/fix-plan.ts` | Rebuild around `code → fix`; project to 100 |
| `src/lib/audit/report-html.ts` | Story-arc client report, plain voice, AEO section |
| `src/lib/audit/report-fix-html.ts` | Reflect code-keyed fixes |
| `src/lib/audit/narratives.ts` | Retune voice (5-yo, firm-consultative) |
| `src/lib/audit/claude-prompt.ts` | Keep prompt generation off the new fix-plan |
| `src/app/audits/page.tsx` | Default crawl control to "Main pages (auto)" |
| `src/lib/audit/__tests__/*.test.ts` | vitest unit + coverage + calibration tests |

---

## Task 1: Add vitest + test script

**Files:**
- Modify: `package.json` (devDeps + `"test"` script)
- Create: `vitest.config.ts`
- Create: `src/lib/audit/__tests__/smoke.test.ts`

**Interfaces:**
- Produces: `npm test` runs vitest; `import { describe, it, expect } from "vitest"` works.

- [ ] Step 1: `npm i -D vitest`
- [ ] Step 2: Create `vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
export default defineConfig({ test: { include: ["src/**/*.test.ts"], environment: "node" } });
```
- [ ] Step 3: Add `"test": "vitest run"` and `"test:watch": "vitest"` to `package.json` scripts.
- [ ] Step 4: Create `smoke.test.ts` with `it("runs", () => expect(1).toBe(1))`.
- [ ] Step 5: Run `npm test` → PASS. Commit `chore(test): add vitest`.

## Task 2: Finding type + code registry

**Files:**
- Create: `src/lib/audit/finding-codes.ts`
- Modify: `src/lib/audit/types.ts` (add `Finding`; `CategoryResult.findings: Finding[]`)

**Interfaces:**
- Produces:
```ts
// finding-codes.ts
export type FindingCode = string & { readonly __brand: "FindingCode" };
export const FINDING_CODES = [
  // seo.*, aeo.*, speed.*, content.*, cta.*, trust.*, conversion.*, usability.*, visual.*
  "seo.title.missing", "seo.title.duplicate", /* …full list, one per scoring deduction… */
] as const;
export type KnownCode = typeof FINDING_CODES[number];
```
```ts
// types.ts
export interface Finding { code: string; label: string; pointsLost: number; detail?: string; }
export interface CategoryResult { /* …unchanged… */ findings: Finding[]; }
```

- [ ] Step 1: Write `finding-codes.ts` — start with an empty-ish `FINDING_CODES` list; it grows as each scorer is converted (Task 4). Export `KnownCode`.
- [ ] Step 2: Add `Finding` to `types.ts`; change `CategoryResult.findings` to `Finding[]`.
- [ ] Step 3: `npx tsc --noEmit` — expect errors in scorers/reports that build `findings` as strings. These are the conversion sites for Tasks 4–7. Commit the type change alone (`feat(audit): introduce Finding code type`) — downstream tasks fix the fallout. (Compile break is expected and contained; do NOT ship to prod between Task 2 and Task 7.)

## Task 3: Shared AEO scorer

**Files:**
- Create: `src/lib/seo/aeo-score.ts` (shared, pure — the single AEO scoring implementation)
- Create: `src/lib/audit/scoring/aeo.ts` (thin adapter: `CrawledPage[]` + robots → `AeoInput` → `scoreAeo`)
- Create: `src/lib/seo/__tests__/aeo-score.test.ts`
- Modify: `src/lib/audit/crawl.ts` (capture AI-crawler disallow rules into the robots result)

**Interfaces:**
- Produces (shared):
```ts
// aeo-score.ts
export interface AeoPage {
  url: string;
  headings: { level: number; text: string }[];
  bodyText: string;
  structuredData: unknown[];   // parsed JSON-LD objects
  metaDescription: string;
  ogTags: Record<string, string>;
}
export interface AeoInput {
  pages: AeoPage[];
  blockedAiBots: string[];     // UA names disallowed for "/"
  hasLlmsTxt: boolean;
}
export function scoreAeo(input: AeoInput): { score: number; findings: Finding[] };
```
- The audit adapter maps `CrawledPage` → `AeoPage` (fields line up) and derives `blockedAiBots`/`hasLlmsTxt` from the crawl's robots + a `/llms.txt` HEAD check. The SEO agent (Task 11) already has `blockedAiBots` + llms.txt in `site-checks.ts` and per-page snapshots — it builds `AeoInput` from those.

- [ ] Step 1: Write `aeo-score.test.ts` — fixtures: (a) Org+FAQ JSON-LD, question headings, `hasLlmsTxt: true`, no AI blocks → score ≥ 90; (b) bare page, `blockedAiBots: ["GPTBot"]`, no schema → score ≤ 25 with codes `aeo.schema.absent`, `aeo.aicrawlers.blocked`, `aeo.faq.absent`.
- [ ] Step 2: Run → FAIL (no `scoreAeo`).
- [ ] Step 3: Implement `scoreAeo(input: AeoInput)` per the spec rubric (§2): JSON-LD presence/coverage, Org/LocalBusiness NAP, FAQ schema/blocks, question-formatted headings, answer-first content, `hasLlmsTxt`, `sameAs`, NAP consistency, freshness, AI-crawler allow, semantic headings, machine summary. Each deduction pushes a `Finding` with an `aeo.*` code + `pointsLost`. Add those codes to `FINDING_CODES`. Then write `scoring/aeo.ts` adapter.
- [ ] Step 4: Run → PASS. Commit `feat(seo): shared AEO scorer + audit adapter`.

## Task 4: Convert existing scorers to coded findings

**Files (modify each):** `scoring/seo.ts`, `performance.ts`, `visual-design.ts`, `usability.ts`, `cta.ts`, `trust.ts`, `content.ts`, `conversion.ts`

**Interfaces:**
- Each scorer already returns `{ score, findings }`. Change `findings` from `string[]` to `Finding[]`: every place that pushes a finding string now pushes `{ code, label, pointsLost }`, where `label` is the current string and `pointsLost` is the points that branch deducts. Register every new code in `FINDING_CODES`.

- [ ] Step 1: For each scorer, convert its findings to coded `Finding`s (keep wording as `label`). Do one scorer per commit.
- [ ] Step 2: After each, `npx tsc --noEmit` for that file's consumers; commit `refactor(audit): coded findings for <category>`.
- [ ] Step 3: After all eight, add `__tests__/codes-unique.test.ts` asserting `FINDING_CODES` has no duplicates. Run → PASS. Commit.

## Task 5: Weight rebalance + register AEO

**Files:** Modify `src/lib/audit/scoring/index.ts`; Create `__tests__/weights.test.ts`

**Interfaces:**
- Consumes: `scoreAeo` (Task 3).
- Produces: `runScoring` returns 9 categories; weights per spec §3.

- [ ] Step 1: Write `weights.test.ts` — sum of category weights === 100; AEO present at 12.
- [ ] Step 2: Run → FAIL.
- [ ] Step 3: In `index.ts`, add the `aeo` category (name "AI Search (AEO)", weight 12) and set weights: visual 8, usability 8, cta 13, seo 13, performance 10, content 13, trust 13, conversion 10, aeo 12.
- [ ] Step 4: Run → PASS. `npx tsc --noEmit`. Commit `feat(audit): add AEO category, rebalance weights`.

## Task 6: finding-copy dictionary + coverage test

**Files:** Create `src/lib/audit/finding-copy.ts`; Create `__tests__/copy-coverage.test.ts`

**Interfaces:**
- Produces: `findingCopy(code: string): { plain: string; impact: string }` (throws/falls back for unknown code).

- [ ] Step 1: Write `copy-coverage.test.ts` — every code in `FINDING_CODES` has a `finding-copy` entry.
- [ ] Step 2: Run → FAIL (dictionary empty).
- [ ] Step 3: Populate `finding-copy.ts`: `code → { plain, impact }` in 5-year-old language with business impact for every code. Example: `seo.title.missing → { plain: "Some pages don't have a name at the top.", impact: "Google and AI don't know what the page is about, so fewer people find you." }`.
- [ ] Step 4: Run → PASS. Commit `feat(audit): plain-English finding copy`.

## Task 7: Rebuild fix-plan around codes; project to 100

**Files:** Modify `src/lib/audit/fix-plan.ts`, `report-fix-html.ts`, `claude-prompt.ts`; Create `__tests__/fix-coverage.test.ts`

**Interfaces:**
- Produces: `fixFor(code): { fix; priority; difficulty; timeEstimate }`; `buildFixPlan(result)` where `projectedScore === 100` when all fixes applied.

- [ ] Step 1: Write `fix-coverage.test.ts` — every code has a `fixFor` entry; and given a synthetic `AuditResult` with known `pointsLost`, `buildFixPlan(...).projectedScore === 100`.
- [ ] Step 2: Run → FAIL.
- [ ] Step 3: Replace the string-pattern matching with a `code → fix` map. Compute `projectedScore` as current + Σ(pointsLost across all findings) capped at 100 per category then reweighted → 100 overall. Ensure `report-fix-html.ts` and `claude-prompt.ts` read the coded fixes.
- [ ] Step 4: Run → PASS. `npx tsc --noEmit`. Commit `feat(audit): code-keyed fix-plan projecting to 100`.

## Task 8: Client report story arc + plain voice + AEO section

**Files:** Modify `src/lib/audit/report-html.ts`, `narratives.ts`

- [ ] Step 1: In `report-html.ts`, render each finding via `findingCopy(f.code)` (plain + impact) — never `label`, never any fix. Add the AEO category section. Reorder into the story arc: cover → alarming-but-credible summary ("what's wrong / what it's costing you") → per-category plain findings → soft close.
- [ ] Step 2: In `narratives.ts`, retune the Claude prompt for 5-yo reading level + firm-consultative tone; keep the model current (`claude-*`, per repo convention). No fix language in client narratives.
- [ ] Step 3: Generate a report for a real fixture site via a `tsx` script; eyeball voice + that no fixes leak. `npx tsc --noEmit` + `eslint`. Commit `feat(audit): story-arc client report with AEO`.

## Task 9: Main-pages crawl + UI default

**Files:** Create `src/lib/audit/discover-main-pages.ts`; Modify `crawl.ts`, `src/app/audits/page.tsx`; Create `__tests__/discover-main-pages.test.ts`

**Interfaces:**
- Produces: `discoverMainPages(home: CrawledPage, cap = 15): string[]`

- [ ] Step 1: Write `discover-main-pages.test.ts` — nav-rich homepage fixture → returns homepage + nav/footer links deduped, capped 15; nav-poor fixture → falls back (returns just homepage list for the caller to top up via sitemap/BFS).
- [ ] Step 2: Run → FAIL.
- [ ] Step 3: Implement `discoverMainPages` (rank header/footer nav links, dedupe by path, drop asset/anchor/off-site). Add a `"main"` mode to `crawl.ts` that seeds from it and tops up from sitemap/BFS to the cap when nav is thin.
- [ ] Step 4: Default the `src/app/audits/page.tsx` page-count control to "Main pages (auto)"; keep 10/25/50 overrides.
- [ ] Step 5: Run tests → PASS. `npx tsc --noEmit`. Commit `feat(audit): main-pages crawl by default`.

## Task 10: Calibration

**Files:** Create `src/lib/audit/__tests__/calibration.test.ts` (fixtures) + a `tsx` calibration script (not committed to app)

- [ ] Step 1: Build a "strong site" fixture (all signals present) → overall score ≥ 95, and confirm a truly-complete fixture scores **100**. Build a "weak site" fixture → overall ≤ 40 with a coherent negative story.
- [ ] Step 2: Review every scorer for **unwinnable points** (e.g. third-party badges); make earnable by a good build or drop from the max. Re-run until the strong fixture can reach 100.
- [ ] Step 3: Run a real audit against a Niewdel-built site and a weak prospect site via the running app; sanity-check scores + report voice.
- [ ] Step 4: Commit `test(audit): calibration fixtures + winnable scoring`.

## Task 11: AEO in the recurring SEO agent

Give clients a first-class AEO health score in the monthly report, reusing the
shared `scoreAeo`. The SEO agent already checks AI-bot blocks + `/llms.txt` in
`site-checks.ts` and crawls per-page snapshots, so the inputs mostly exist.

**Files:**
- Modify: `src/lib/seo/scoring.ts` (add `aeo` to the returned scores via `scoreAeo`)
- Modify: `src/lib/seo/pipeline.ts` (build `AeoInput` from crawled snapshots + `site-checks` robots/llms result; persist the AEO score)
- Modify: storage + `getReportData` (`src/lib/seo/report-data.ts`) so `health` carries an `aeo` ScoreCard
- Modify: `src/lib/seo/monthly-report-email.ts` + `src/components/seo/report/health-section.tsx` (render an AEO score card alongside Technical/On-Page/Lighthouse)
- Migration: **only if** the health scores are stored as typed columns in `seo_checks` — add an `aeo_score` column (nullable int). If scores are stored as JSON, no migration.

**Interfaces:**
- Consumes: `scoreAeo(input: AeoInput)` (Task 3).
- Produces: `health.aeo: ScoreCard` in `ReportData`.

- [ ] Step 1: Inspect how `seo_checks` stores health scores (columns vs JSON) to decide on a migration. If a column is needed, `apply_migration` adds `aeo_score int` (nullable) — existing rows stay null and render as "Getting started".
- [ ] Step 2: In `scoring.ts`, compute `aeo` via `scoreAeo` from the pipeline's page snapshots + site-checks; return it alongside the existing scores.
- [ ] Step 3: Persist `aeo_score` in the pipeline write; extend `getReportData` to hydrate `health.aeo` (current + delta + history), mirroring the technical/onpage ScoreCards.
- [ ] Step 4: Render an AEO score card in the email + web health section (same MetricCardInline pattern; label "AI Search").
- [ ] Step 5: `npx tsc --noEmit` + `eslint`; run a real report render for a client via `tsx` to confirm the AEO card shows. Commit `feat(seo): first-class AEO health score in monthly reports`.

---

## Self-Review notes

- **Spec coverage:** main-pages crawl (T9), AEO (T3/T5), finding codes (T2/T4), plain copy (T6), story report (T8), 100-projection fix-plan (T7), calibration/winnable (T10). All spec sections mapped.
- **Sequencing risk:** T2 intentionally breaks compilation; the branch must not deploy to prod until T7 restores a green build. Build on a feature branch cut from `main`; merge only when tsc/eslint/tests all pass.
- **Type consistency:** `Finding{code,label,pointsLost}` is the single shape across scorers, finding-copy, and fix-plan. `findingCopy(code)` and `fixFor(code)` are the two consumers; both keyed by the same `FINDING_CODES` list guarded by coverage tests.
