import { describe, it, expect } from "vitest";
import { scoreAeo, type AeoInput, type AeoPage } from "../aeo-score";

function strongHomepage(): AeoPage {
  return {
    url: "https://example.com/",
    headings: [
      { level: 1, text: "Best Plumbers in Springfield" },
      { level: 2, text: "What services do you offer?" },
      { level: 2, text: "How much does it cost?" },
    ],
    bodyText:
      "Best Plumbers in Springfield " +
      "What services do you offer? We provide emergency plumbing, drain cleaning, " +
      "and water heater repair for homes throughout Springfield. " +
      "How much does it cost? Most repairs range from $100 to $300 depending on " +
      "the issue and are quoted upfront before any work begins. " +
      "Frequently Asked Questions. " +
      "Updated January 2026.",
    structuredData: [
      {
        "@context": "https://schema.org",
        "@type": "LocalBusiness",
        name: "Springfield Plumbing Co",
        telephone: "555-123-4567",
        address: {
          "@type": "PostalAddress",
          streetAddress: "123 Main St",
          addressLocality: "Springfield",
          addressRegion: "IL",
          postalCode: "62701",
        },
        sameAs: ["https://facebook.com/springfieldplumbing", "https://x.com/springfieldplumb"],
      },
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: [
          {
            "@type": "Question",
            name: "What services do you offer?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Emergency plumbing, drain cleaning, and water heater repair.",
            },
          },
        ],
      },
    ],
    metaDescription: "Springfield Plumbing Co offers emergency plumbing, drain cleaning, and water heater repair.",
    ogTags: {
      "og:title": "Springfield Plumbing Co",
      "og:description": "Emergency plumbing and drain cleaning in Springfield, IL.",
    },
  };
}

function strongAboutPage(): AeoPage {
  return {
    url: "https://example.com/about",
    headings: [{ level: 1, text: "About Springfield Plumbing Co" }],
    bodyText:
      "About Springfield Plumbing Co. We've served Springfield, IL since 2010. Updated January 2026.",
    structuredData: [
      {
        "@context": "https://schema.org",
        "@type": "LocalBusiness",
        name: "Springfield Plumbing Co",
        telephone: "555-123-4567",
        address: {
          "@type": "PostalAddress",
          streetAddress: "123 Main St",
          addressLocality: "Springfield",
          addressRegion: "IL",
          postalCode: "62701",
        },
        sameAs: ["https://facebook.com/springfieldplumbing"],
      },
    ],
    metaDescription: "Learn about Springfield Plumbing Co, serving Springfield, IL since 2010.",
    ogTags: { "og:title": "About Springfield Plumbing Co" },
  };
}

function barePage(): AeoPage {
  return {
    url: "https://example.com/",
    headings: [],
    bodyText: "Welcome to our site. We do things. Contact us for more information.",
    structuredData: [],
    metaDescription: "",
    ogTags: {},
  };
}

describe("scoreAeo", () => {
  it("scores a well-optimized site >= 90 with no findings blocking AI crawlers", () => {
    const input: AeoInput = {
      pages: [strongHomepage(), strongAboutPage()],
      blockedAiBots: [],
      hasLlmsTxt: true,
    };

    const result = scoreAeo(input);

    expect(result.score).toBeGreaterThanOrEqual(90);
    expect(result.findings.some((f) => f.code === "aeo.aicrawlers.blocked")).toBe(false);
  });

  it("scores a bare, blocked page <= 25 with the expected codes", () => {
    const input: AeoInput = {
      pages: [barePage()],
      blockedAiBots: ["GPTBot"],
      hasLlmsTxt: false,
    };

    const result = scoreAeo(input);

    expect(result.score).toBeLessThanOrEqual(25);
    const codes = result.findings.map((f) => f.code);
    expect(codes).toContain("aeo.schema.absent");
    expect(codes).toContain("aeo.aicrawlers.blocked");
    expect(codes).toContain("aeo.faq.absent");
  });

  it("caps score at 100 and never returns negative points", () => {
    const input: AeoInput = {
      pages: [strongHomepage(), strongAboutPage()],
      blockedAiBots: [],
      hasLlmsTxt: true,
    };
    const result = scoreAeo(input);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });
});
