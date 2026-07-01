# Audit Tool v2 — Sales-Weapon Website Audit

**Date:** 2026-06-30
**Status:** Approved design, pre-implementation
**Owner:** Justin Ledwein / Niewdel

## Purpose

Turn the existing website-audit tool into a sharper sales instrument for selling
website rebuilds. It runs an internal audit of a prospect's site, produces a
**client-facing report** that tells a plain-English story of everything wrong
(and what it costs them) **without telling them how to fix it**, plus an
**internal fix-plan** that lays out the concrete path to a perfect score so
Niewdel can build/repair a site and re-audit it to 100.

This is an **enhancement** of the existing tool (`src/lib/audit/*`,
`src/app/audits`, `src/app/api/audits`), not a rewrite. The current tool already
does a multi-page Playwright crawl, scores 8 weighted categories, generates a
client report (findings only) + an internal fix-plan + a "copy Claude prompt",
runs PageSpeed/Core Web Vitals, and tracks progress via a `audits` table with
realtime UI.

## Locked decisions

1. **Crawl scope:** default to "main pages, auto" (~up to 15) — homepage + primary
   nav/footer links + key pages. Fall back to sitemap/BFS when nav is thin.
2. **AEO:** add **AEO (AI search)** as its own scored category, separate from SEO.
3. **Tone:** *firm but consultative* — direct and unflinching about problems,
   professional and advisory in voice, never an insulting "roast."
4. **Entry point:** internal-only for now (behind login). Architect nothing that
   blocks a future public lead-gen entry, but build no public surface now.
5. **Language:** every client-facing finding reads at a 5-year-old level with a
   business-impact line. Technical detail stays in the internal fix-plan.

## Goals / success criteria

- An audit scans a site's main pages by default with no extra input.
- The client report covers **Content, Speed, SEO, AEO** plus the existing
  Visual Design, Usability, CTAs, Trust, Conversion — each in plain language with
  business impact, and **no how-to-fix instructions**.
- The internal fix-plan maps **every** deducted point to a concrete fix such that
  applying all fixes yields a **projected score of 100**.
- Scoring is **winnable**: a properly built (Niewdel) site can actually reach 100
  — no points that require things outside a well-built site's control.
- Re-auditing a site we build/repair confirms the score rises to ~100.

## Core architectural change: finding codes

Today findings are free-text strings, and the fix-plan matches them with ~62
fragile string patterns. That makes the "plain-English copy" and "every deduction
has a fix" guarantees impossible to enforce.

**Introduce a stable `code` on every finding.** Each scoring rule emits:

```ts
interface Finding {
  code: string;        // stable id, e.g. "seo.title.missing", "aeo.schema.absent"
  label: string;       // technical/internal wording (fix-plan, Claude prompt)
  pointsLost: number;  // points this deduction cost within its category
  detail?: string;     // optional specifics (e.g. which pages)
}
```

Two code-keyed dictionaries consume this:

- `finding-copy.ts`: `code → { plain, impact }` — plain-English + business impact
  for the **client report**.
- `fix-plan.ts`: `code → { fix, priority, difficulty, timeEstimate }` — the
  **internal** fix, effort, and impact.

**Enforcement (test):** every `code` any scorer can emit must have an entry in
both dictionaries. A unit test enumerates all codes and asserts full coverage, so
the client report never shows an unexplained finding and the fix-plan can always
project to 100.

This replaces the string-pattern matching in the current `fix-plan.ts`.

## Workstreams

### 1. Main-pages crawl (`src/lib/audit/discover-main-pages.ts`, `crawl.ts`)

- New `discoverMainPages(homepage): string[]` — extract links inside the
  homepage's `<nav>`/header and footer, rank by nav prominence, dedupe by path,
  drop off-site/asset/anchor links, cap at ~15 (homepage always included).
- If nav yields < ~5 pages, fall back to the existing sitemap/BFS discovery to
  fill up to the cap.
- `crawl.ts` gains a `"main"` mode that seeds the crawl from this set.
- UI (`src/app/audits/page.tsx`): default the page-count control to
  **"Main pages (auto)"**; keep 10/25/50 as explicit overrides.

### 2. AEO category (`src/lib/audit/scoring/aeo.ts`)

New pure scorer, max 100 pts, over the crawled pages + robots.txt:

| Signal | Pts |
|---|---|
| JSON-LD structured data on homepage | 12 (+6 if on >50% of pages) |
| Organization/LocalBusiness schema with NAP | 10 |
| FAQ schema or visible FAQ/Q&A blocks | 10 |
| Question-formatted headings (H2/H3 as questions) | 8 |
| Answer-first content (concise lead paragraph under headings) | 8 |
| `llms.txt` present | 6 |
| `sameAs` / social entity links in schema | 6 |
| Consistent NAP across pages (entity clarity) | 8 |
| Visible content freshness (dates / sitemap lastmod) | 6 |
| AI crawlers **not** blocked (GPTBot, ClaudeBot, PerplexityBot, Google-Extended) | 10 |
| Clean semantic headings / single H1 | 5 |
| Machine summary present (meta description + OG) | 5 |

`robots.txt` parsing already exists in `crawl.ts`; extend it to capture
AI-crawler user-agent disallow rules.

### 3. Weight rebalance (`src/lib/audit/scoring/index.ts`)

Add AEO and rebalance to sum 100:

| Category | Old | New |
|---|---|---|
| Visual Design & Branding | 10 | 8 |
| Usability & Navigation | 10 | 8 |
| Calls to Action | 15 | 13 |
| SEO Fundamentals | 15 | 13 |
| Performance & Speed | 10 | 10 |
| Content Quality | 15 | 13 |
| Trust & Credibility | 15 | 13 |
| Conversion Architecture | 10 | 10 |
| **AEO (AI search)** | — | **12** |
| **Total** | 100 | 100 |

### 4. Plain-English findings (`src/lib/audit/finding-copy.ts`)

- `code → { plain, impact }` dictionary. Example:
  `seo.title.missing → { plain: "Some pages don't have a name at the top, so Google shows a blank or a guess.", impact: "Fewer people click your site in search results." }`
- Client report renders `plain` + `impact`; never `label` or any fix text.

### 5. Story-arc client report (`report-html.ts`, `narratives.ts`)

- Retune the AI narrative voice: 5-year-old reading level, firm/consultative,
  short sentences, no jargon, no fix instructions.
- Report flow: cover score → alarming-but-credible summary ("here's what's wrong
  and what it's costing you") → per-category plain findings with impact → a soft
  close ("this is fixable — that's what we do"). Keep the existing dark Niewdel
  branding.
- Add an **AEO section** and ensure **Content** and **Speed** sections read in the
  same plain, impact-first voice.

### 6. Internal fix-plan → guaranteed 100 (`fix-plan.ts`, `report-fix-html.ts`, `claude-prompt.ts`)

- Rebuild `fix-plan.ts` around the `code → fix` dictionary. Group by category,
  keep quick-wins (critical + easy), and compute projected score assuming all
  fixes applied — which must resolve to **100** given full code coverage.
- `claude-prompt.ts` keeps generating the Claude-Code task list from the fix-plan
  so we can point Claude at our own build and close remaining gaps.

### 7. Calibration

- Review every scoring rule for **unwinnable points** (things a well-built site
  can't earn, e.g. third-party badges). Either make them earnable by a good build
  or drop them from the max.
- Verify empirically: audit a strong reference site (target ~90–100) and a weak
  site (target low + coherent negative story), and confirm a Niewdel-built site
  can reach 100.

## Out of scope (v2)

- Public/lead-gen entry, lead capture, rate limiting, abuse protection.
- DB schema changes — categories live in the existing `result` JSONB; no migration.
- Desktop PageSpeed strategy, historical trend tracking for audits.
- Automated fixing — the fix-plan/Claude-prompt remain the human-driven path.

## Testing

- Unit: `aeo.ts` scoring against fixture pages; `discoverMainPages` on
  nav-rich and nav-poor fixtures; weight sum == 100.
- Coverage test: every finding `code` emitted by any scorer has a `finding-copy`
  entry **and** a `fix-plan` entry (guards the 100 path and the client report).
- Calibration: strong-site and weak-site fixtures assert score bands and that a
  perfect fixture scores 100.

## File map

| File | Change |
|---|---|
| `src/lib/audit/types.ts` | Add `Finding` shape with `code`/`label`/`pointsLost` |
| `src/lib/audit/discover-main-pages.ts` | New — main-nav page discovery |
| `src/lib/audit/crawl.ts` | `"main"` crawl mode; capture AI-crawler robots rules |
| `src/lib/audit/scoring/aeo.ts` | New — AEO scorer |
| `src/lib/audit/scoring/index.ts` | Register AEO, rebalance weights |
| `src/lib/audit/scoring/*.ts` | Emit findings with stable `code`s |
| `src/lib/audit/finding-copy.ts` | New — `code → { plain, impact }` |
| `src/lib/audit/fix-plan.ts` | Rebuild around `code → fix`; project to 100 |
| `src/lib/audit/report-html.ts` | Story arc, plain voice, AEO section |
| `src/lib/audit/narratives.ts` | Retune voice (5-yo, firm-consultative) |
| `src/lib/audit/report-fix-html.ts` | Reflect code-keyed fixes |
| `src/lib/audit/claude-prompt.ts` | Keep prompt gen off the new fix-plan |
| `src/app/audits/page.tsx` | Default to "Main pages (auto)" |
