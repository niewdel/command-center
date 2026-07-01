import { describe, it, expect } from "vitest";
import { discoverMainPages } from "../discover-main-pages";
import type { CrawledPage } from "../types";

function makePage(url: string, links: CrawledPage["links"]): CrawledPage {
  return {
    url,
    title: "Home",
    metaDescription: "",
    headings: [],
    bodyText: "",
    links,
    headLinks: [],
    images: [],
    forms: [],
    iframes: [],
    buttons: [],
    ogTags: {},
    structuredData: [],
    statusCode: 200,
  };
}

describe("discoverMainPages", () => {
  it("returns the homepage + deduped nav/footer links, capped at 15", () => {
    const home = makePage("https://example.com/", [
      { href: "https://example.com/about", text: "About", isInternal: true, location: "nav" },
      { href: "https://example.com/services", text: "Services", isInternal: true, location: "nav" },
      { href: "https://example.com/services/", text: "Services (dup)", isInternal: true, location: "header" },
      { href: "https://example.com/contact", text: "Contact", isInternal: true, location: "header" },
      { href: "https://example.com/blog", text: "Blog", isInternal: true, location: "footer" },
      { href: "https://example.com/privacy", text: "Privacy", isInternal: true, location: "footer" },
      { href: "https://example.com/terms", text: "Terms", isInternal: true, location: "footer" },
      // Off-site, asset, anchor, mailto, tel — all should be dropped
      { href: "https://other-site.com/partner", text: "Partner", isInternal: false, location: "footer" },
      { href: "https://example.com/brochure.pdf", text: "Brochure", isInternal: true, location: "nav" },
      { href: "https://example.com/#top", text: "Back to top", isInternal: true, location: "body" },
      { href: "mailto:hello@example.com", text: "Email us", isInternal: true, location: "footer" },
      { href: "tel:+15555555555", text: "Call us", isInternal: true, location: "footer" },
      // In-body link, not nav/header/footer — should be excluded from nav discovery
      { href: "https://example.com/random-body-link", text: "random", isInternal: true, location: "body" },
    ]);

    const result = discoverMainPages(home);

    // Homepage always included, first
    expect(result[0]).toBe("https://example.com/");
    // Deduped (services and services/ collapse to one)
    expect(result.filter((u) => u.includes("services")).length).toBe(1);
    // Off-site, asset, anchor, mailto, tel, and plain-body links excluded
    expect(result.some((u) => u.includes("other-site.com"))).toBe(false);
    expect(result.some((u) => u.includes("brochure.pdf"))).toBe(false);
    expect(result.some((u) => u.includes("#top"))).toBe(false);
    expect(result.some((u) => u.startsWith("mailto:"))).toBe(false);
    expect(result.some((u) => u.startsWith("tel:"))).toBe(false);
    expect(result.some((u) => u.includes("random-body-link"))).toBe(false);
    // Nav/header/footer links present
    expect(result.some((u) => u.includes("/about"))).toBe(true);
    expect(result.some((u) => u.includes("/contact"))).toBe(true);
    expect(result.some((u) => u.includes("/blog"))).toBe(true);
    // Capped at 15
    expect(result.length).toBeLessThanOrEqual(15);
  });

  it("caps at a custom limit and always keeps the homepage even when nav is huge", () => {
    const links: CrawledPage["links"] = Array.from({ length: 40 }, (_, i) => ({
      href: `https://example.com/page-${i}`,
      text: `Page ${i}`,
      isInternal: true,
      location: "nav" as const,
    }));
    const home = makePage("https://example.com/", links);

    const result = discoverMainPages(home, 5);

    expect(result.length).toBeLessThanOrEqual(5);
    expect(result[0]).toBe("https://example.com/");
  });

  it("falls back to just the homepage when nav is thin/absent", () => {
    const home = makePage("https://example.com/", [
      { href: "https://example.com/random-body-link", text: "random", isInternal: true, location: "body" },
      { href: "https://external.com/thing", text: "external", isInternal: false, location: "nav" },
    ]);

    const result = discoverMainPages(home);

    expect(result).toEqual(["https://example.com/"]);
  });

  it("handles a homepage with no links at all", () => {
    const home = makePage("https://example.com/", []);
    const result = discoverMainPages(home);
    expect(result).toEqual(["https://example.com/"]);
  });
});
