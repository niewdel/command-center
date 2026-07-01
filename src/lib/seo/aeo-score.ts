import type { Finding } from "@/lib/audit/types";

/**
 * Shared, pure AEO (AI-search / answer-engine optimization) scorer.
 *
 * Used by both the audit tool (via `src/lib/audit/scoring/aeo.ts`) and the
 * recurring SEO agent. This module does no fetching — callers crawl pages and
 * check robots.txt / llms.txt themselves, then hand in normalized input.
 *
 * Rubric (spec: docs/superpowers/specs/2026-06-30-audit-tool-v2-design.md §2),
 * max 100 pts:
 *   - JSON-LD on homepage (12) + coverage >50% of pages (6)
 *   - Organization/LocalBusiness schema with NAP (10)
 *   - FAQ schema or visible FAQ/Q&A blocks (10)
 *   - Question-formatted H2/H3 headings (8)
 *   - Answer-first content under headings (8)
 *   - llms.txt present (6)
 *   - sameAs / social entity links in schema (6)
 *   - Consistent NAP across pages (8)
 *   - Visible content freshness (6)
 *   - AI crawlers not blocked (10)
 *   - Clean semantic headings / single H1 (5)
 *   - Machine summary present — meta description + OG (5)
 */

export interface AeoPage {
  url: string;
  headings: { level: number; text: string }[];
  bodyText: string;
  structuredData: unknown[]; // parsed JSON-LD objects
  metaDescription: string;
  ogTags: Record<string, string>;
}

export interface AeoInput {
  pages: AeoPage[];
  blockedAiBots: string[]; // UA names disallowed for "/"
  hasLlmsTxt: boolean;
}

const FRESHNESS_PATTERN =
  /(updated|last updated|posted|published)\s*[:\-]?\s*[a-z]*\.?\s*\d{4}|\b\d{4}-\d{2}-\d{2}\b|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}?,?\s*\d{4}\b/i;

const FAQ_HEADING_PATTERN = /faq|frequently asked questions|q\s*&\s*a/i;

// ---------------------------------------------------------------------------
// JSON-LD helpers (unknown + narrowing, no `any`)
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function flattenEntities(structuredData: unknown[]): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const visit = (item: unknown) => {
    if (Array.isArray(item)) {
      item.forEach(visit);
      return;
    }
    if (!isRecord(item)) return;
    out.push(item);
    const graph = item["@graph"];
    if (Array.isArray(graph)) graph.forEach(visit);
  };
  structuredData.forEach(visit);
  return out;
}

function typeMatches(entity: Record<string, unknown>, type: string): boolean {
  const t = entity["@type"];
  const types = Array.isArray(t) ? t : [t];
  return types.some((x) => typeof x === "string" && x.toLowerCase() === type.toLowerCase());
}

function isOrgLike(entity: Record<string, unknown>): boolean {
  const t = entity["@type"];
  const types = Array.isArray(t) ? t : [t];
  return types.some((x) => typeof x === "string" && /organization|business/i.test(x));
}

function stringField(entity: Record<string, unknown>, key: string): string | undefined {
  const v = entity[key];
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

function addressString(entity: Record<string, unknown>): string | undefined {
  const addr = entity["address"];
  if (typeof addr === "string" && addr.trim()) return addr.trim();
  if (isRecord(addr)) {
    const parts = ["streetAddress", "addressLocality", "addressRegion", "postalCode"]
      .map((k) => stringField(addr, k))
      .filter((x): x is string => Boolean(x));
    if (parts.length) return parts.join(", ");
  }
  return undefined;
}

function hasSameAs(entity: Record<string, unknown>): boolean {
  const sa = entity["sameAs"];
  if (Array.isArray(sa)) return sa.some((x) => typeof x === "string" && x.trim().length > 0);
  return typeof sa === "string" && sa.trim().length > 0;
}

// ---------------------------------------------------------------------------
// Content heuristics
// ---------------------------------------------------------------------------

function hasQuestionHeadings(pages: AeoPage[]): boolean {
  return pages.some((p) =>
    p.headings.some((h) => (h.level === 2 || h.level === 3) && h.text.trim().endsWith("?"))
  );
}

/** Heuristic: does a heading's following text read like a short, direct answer? */
function isAnswerFirst(pages: AeoPage[]): boolean {
  let total = 0;
  let hits = 0;

  for (const page of pages) {
    const sectionHeadings = page.headings.filter((h) => h.level === 2 || h.level === 3);
    for (const heading of sectionHeadings) {
      total++;
      const idx = page.bodyText.indexOf(heading.text);
      if (idx === -1) continue;

      const after = page.bodyText.slice(idx + heading.text.length, idx + heading.text.length + 400);

      // Trim the window at the next heading's text, if it appears in range.
      let windowEnd = after.length;
      for (const other of page.headings) {
        if (other === heading) continue;
        const otherIdx = after.indexOf(other.text);
        if (otherIdx !== -1 && otherIdx < windowEnd) windowEnd = otherIdx;
      }

      const segment = after.slice(0, windowEnd).trim();
      if (!segment) continue;

      const sentenceEnd = segment.search(/[.!?]/);
      const firstSentenceLen = sentenceEnd === -1 ? segment.length : sentenceEnd + 1;
      if (firstSentenceLen > 0 && firstSentenceLen <= 320) hits++;
    }
  }

  if (total === 0) return false;
  return hits / total >= 0.5;
}

// ---------------------------------------------------------------------------
// Scorer
// ---------------------------------------------------------------------------

export function scoreAeo(input: AeoInput): { score: number; findings: Finding[] } {
  const { pages, blockedAiBots, hasLlmsTxt } = input;
  const findings: Finding[] = [];
  const homepage: AeoPage | undefined = pages[0];
  const entities = flattenEntities(pages.flatMap((p) => p.structuredData));
  const orgEntities = entities.filter(isOrgLike);

  // 1. JSON-LD on homepage (12 pts)
  if (!homepage || homepage.structuredData.length === 0) {
    findings.push({
      code: "aeo.schema.absent",
      label: "Homepage has no structured data (JSON-LD)",
      pointsLost: 12,
      detail: "AI systems rely on JSON-LD to understand the page without guessing from prose.",
    });
  }

  // 2. JSON-LD coverage across pages (6 pts)
  const pagesWithSchema = pages.filter((p) => p.structuredData.length > 0).length;
  const coverage = pages.length > 0 ? pagesWithSchema / pages.length : 0;
  if (coverage <= 0.5) {
    findings.push({
      code: "aeo.schema.coverage.low",
      label: "Structured data is present on 50% or fewer of the crawled pages",
      pointsLost: 6,
      detail: `${pagesWithSchema} of ${pages.length} page(s) had structured data.`,
    });
  }

  // 3. Organization/LocalBusiness schema with NAP (10 pts)
  const hasNap = orgEntities.some(
    (e) => stringField(e, "name") && (addressString(e) || stringField(e, "telephone"))
  );
  if (!hasNap) {
    findings.push({
      code: "aeo.entity.schema.missing",
      label: "No Organization/LocalBusiness schema with name, address, or phone",
      pointsLost: 10,
      detail: "Without entity schema, AI systems can't confidently identify who this business is.",
    });
  }

  // 4. FAQ schema or visible FAQ/Q&A blocks (10 pts)
  const hasFaqSchema = entities.some((e) => typeMatches(e, "FAQPage"));
  const hasFaqHeading = pages.some((p) => p.headings.some((h) => FAQ_HEADING_PATTERN.test(h.text)));
  const hasFaqContent = hasFaqSchema || hasFaqHeading || hasQuestionHeadings(pages);
  if (!hasFaqContent) {
    findings.push({
      code: "aeo.faq.absent",
      label: "No FAQ schema or visible FAQ/Q&A content",
      pointsLost: 10,
      detail: "FAQ content is one of the most commonly cited formats in AI answers.",
    });
  }

  // 5. Question-formatted H2/H3 headings (8 pts)
  if (!hasQuestionHeadings(pages)) {
    findings.push({
      code: "aeo.headings.notquestions",
      label: "No section headings are phrased as questions",
      pointsLost: 8,
      detail: "Question-formatted headings map directly to how people phrase AI search queries.",
    });
  }

  // 6. Answer-first content under headings (8 pts)
  if (!isAnswerFirst(pages)) {
    findings.push({
      code: "aeo.content.notanswerfirst",
      label: "Section headings aren't followed by a concise, direct answer",
      pointsLost: 8,
      detail: "AI systems favor content that answers a question in the first sentence after a heading.",
    });
  }

  // 7. llms.txt present (6 pts)
  if (!hasLlmsTxt) {
    findings.push({
      code: "aeo.llms.absent",
      label: "No /llms.txt file present",
      pointsLost: 6,
      detail: "llms.txt gives AI systems a quick, parseable overview of the site.",
    });
  }

  // 8. sameAs / social entity links (6 pts)
  if (!entities.some(hasSameAs)) {
    findings.push({
      code: "aeo.entity.sameas.missing",
      label: "No sameAs social/entity links in structured data",
      pointsLost: 6,
      detail: "sameAs links help AI systems disambiguate the business against other entities.",
    });
  }

  // 9. Consistent NAP across pages (8 pts) — only assessable with >1 entity
  if (orgEntities.length > 1) {
    const normalized = orgEntities.map((e) => ({
      name: (stringField(e, "name") ?? "").toLowerCase(),
      address: (addressString(e) ?? "").toLowerCase(),
      phone: (stringField(e, "telephone") ?? "").replace(/\D/g, ""),
    }));
    const first = normalized[0];
    const consistent = normalized.every(
      (n) =>
        (!n.name || !first.name || n.name === first.name) &&
        (!n.address || !first.address || n.address === first.address) &&
        (!n.phone || !first.phone || n.phone === first.phone)
    );
    if (!consistent) {
      findings.push({
        code: "aeo.nap.inconsistent",
        label: "Name/address/phone is inconsistent across pages",
        pointsLost: 8,
        detail: "Conflicting NAP details make AI systems less confident citing this business.",
      });
    }
  }

  // 10. Visible content freshness (6 pts)
  if (!pages.some((p) => FRESHNESS_PATTERN.test(p.bodyText))) {
    findings.push({
      code: "aeo.freshness.absent",
      label: "No visible content freshness signals (dates, \"updated\" text)",
      pointsLost: 6,
      detail: "AI systems favor demonstrably current content over stale, undated pages.",
    });
  }

  // 11. AI crawlers not blocked (10 pts)
  if (blockedAiBots.length > 0) {
    findings.push({
      code: "aeo.aicrawlers.blocked",
      label: "AI crawlers are blocked in robots.txt",
      pointsLost: 10,
      detail: `Blocked: ${blockedAiBots.join(", ")}.`,
    });
  }

  // 12. Clean semantic headings / single H1 (5 pts)
  const h1Count = homepage?.headings.filter((h) => h.level === 1).length ?? 0;
  if (h1Count !== 1) {
    findings.push({
      code: "aeo.headings.structure",
      label: "Homepage doesn't have exactly one H1",
      pointsLost: 5,
      detail: `Found ${h1Count} H1 heading(s) on the homepage.`,
    });
  }

  // 13. Machine summary present — meta description + OG (5 pts)
  const hasMetaDescription = Boolean(homepage?.metaDescription?.trim());
  const hasOgSummary = Boolean(
    homepage?.ogTags?.["og:title"]?.trim() || homepage?.ogTags?.["og:description"]?.trim()
  );
  if (!hasMetaDescription || !hasOgSummary) {
    findings.push({
      code: "aeo.summary.absent",
      label: "Missing a machine-readable summary (meta description + Open Graph tags)",
      pointsLost: 5,
      detail: "Meta description and OG tags are the fastest way for AI systems to summarize a page.",
    });
  }

  const pointsLost = findings.reduce((sum, f) => sum + f.pointsLost, 0);
  const score = Math.max(0, Math.min(100, 100 - pointsLost));

  return { score, findings };
}
