import { describe, it, expect } from "vitest";
import { FINDING_CODES } from "../finding-codes";
import { fixFor, buildFixPlan } from "../fix-plan";
import type { AuditResult, CategoryResult, Finding } from "../types";

describe("fixFor coverage", () => {
  it("has a fix entry for every finding code", () => {
    const missing: string[] = [];

    for (const code of FINDING_CODES) {
      try {
        const entry = fixFor(code);
        if (!entry.fix || entry.fix.trim().length === 0) {
          missing.push(`${code} (empty "fix")`);
        }
      } catch {
        missing.push(`${code} (no entry)`);
      }
    }

    expect(missing).toEqual([]);
  });

  it("throws a clear error for an unknown code", () => {
    expect(() => fixFor("not.a.real.code")).toThrow();
  });
});

function makeFinding(code: string, pointsLost: number): Finding {
  return { code, label: `Finding for ${code}`, pointsLost };
}

function makeCategory(
  category_id: string,
  category_name: string,
  score: number,
  findings: Finding[]
): CategoryResult {
  return {
    category_id,
    category_name,
    score,
    severity: "moderate",
    headline: `${category_name} headline`,
    narrative: `${category_name} narrative`,
    findings,
  };
}

describe("buildFixPlan projection", () => {
  it("projects to a perfect score of 100 once every finding is fixed", () => {
    const result: AuditResult = {
      url: "https://example.com",
      siteName: "Example",
      auditDate: new Date().toISOString(),
      overall_score: 42,
      overall_severity: "serious",
      overall_headline: "headline",
      overall_narrative: "narrative",
      pagesCrawled: 5,
      psiMetrics: [],
      screenshots: [],
      categories: [
        makeCategory("seo", "SEO Fundamentals", 60, [
          makeFinding("seo.title.missing", 20),
          makeFinding("seo.sitemap.missing", 10),
        ]),
        makeCategory("trust", "Trust & Credibility", 30, [
          makeFinding("trust.https.missing", 40),
          makeFinding("trust.testimonials.missing", 15),
        ]),
        makeCategory("aeo", "AI Search Optimization", 50, [
          makeFinding("aeo.schema.absent", 25),
        ]),
        makeCategory("performance", "Performance & Speed", 70, []),
      ],
    };

    const plan = buildFixPlan(result);

    expect(plan.projectedScore).toBe(100);
    for (const cat of plan.categories) {
      expect(cat.targetScore).toBe(100);
    }
  });
});
