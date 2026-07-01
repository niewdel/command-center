import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { runScoring } from "../scoring";
import { scoreAeo, type AeoPage } from "@/lib/seo/aeo-score";
import type { CrawledPage, PSIMetrics } from "../types";

/**
 * Task 10: calibration fixtures.
 *
 * These tests feed fixtures through the real `runScoring` pipeline (all 8
 * synchronous scorers + the async SEO/AEO scorers) to prove the rubric is
 * winnable to 100 for a genuinely well-built site, and tells a coherent
 * negative story for a bare/broken one.
 *
 * Determinism / no live network calls
 * ------------------------------------
 * `runScoring` awaits two network-touching adapters:
 *   - `scoreSEO` (src/lib/audit/scoring/seo.ts) now checks for a real
 *     /sitemap.xml and /robots.txt via `checkUrlExists` (see Task 10 fix
 *     below).
 *   - `scoreAeo`'s audit-tool adapter (src/lib/audit/scoring/aeo.ts) fetches
 *     /robots.txt and HEAD-checks /llms.txt via `fetchAeoRobotsSignals`.
 *
 * Rather than duplicating `runScoring`'s weighting logic to test the 8 sync
 * scorers in isolation, we stub `global.fetch` for the duration of each test
 * so those two adapters resolve deterministically offline -- this exercises
 * the real end-to-end scoring path (including weighting and the SEO/AEO
 * async wiring) without touching the network. For the AEO *rubric* itself
 * (the 13-point breakdown), we additionally call the pure, dependency-free
 * `scoreAeo` from `src/lib/seo/aeo-score.ts` directly with a hand-built
 * `AeoInput` -- no fetch involved at all -- so that portion of the rubric is
 * verified in complete isolation from the network-stubbing trick above.
 */

// ---------------------------------------------------------------------------
// fetch stubbing (deterministic, offline)
// ---------------------------------------------------------------------------

let originalFetch: typeof global.fetch;

beforeEach(() => {
  originalFetch = global.fetch;
});

afterEach(() => {
  global.fetch = originalFetch;
});

interface FetchStubOptions {
  /** null = robots.txt does not exist. Otherwise its raw text body. */
  robotsBody: string | null;
  sitemapOk: boolean;
  llmsOk: boolean;
}

function installFetchStub(opts: FetchStubOptions): void {
  const stub = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input.toString();
    const method = (init?.method ?? "GET").toUpperCase();
    const respond = (ok: boolean, body = ""): Response =>
      ({
        ok,
        status: ok ? 200 : 404,
        text: async () => body,
      }) as unknown as Response;

    if (url.endsWith("/robots.txt")) {
      if (opts.robotsBody === null) return respond(false);
      return respond(true, method === "HEAD" ? "" : opts.robotsBody);
    }
    if (url.endsWith("/sitemap.xml")) return respond(opts.sitemapOk);
    if (url.endsWith("/llms.txt")) return respond(opts.llmsOk);
    return respond(false);
  };
  global.fetch = stub as unknown as typeof fetch;
}

const ALLOW_ALL_ROBOTS = [
  "User-agent: *",
  "Allow: /",
  "Sitemap: https://strongsite.example.com/sitemap.xml",
  "",
].join("\n");

// ---------------------------------------------------------------------------
// Shared structured-data fixtures
// ---------------------------------------------------------------------------

const ORG_ENTITY = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  name: "StrongSite Home Services",
  address: {
    "@type": "PostalAddress",
    streetAddress: "123 Main Street",
    addressLocality: "Charlotte",
    addressRegion: "NC",
    postalCode: "28202",
  },
  telephone: "(704) 555-0134",
  sameAs: [
    "https://facebook.com/strongsite",
    "https://instagram.com/strongsite",
    "https://linkedin.com/company/strongsite",
  ],
};

const FAQ_ENTITY = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What areas do you serve?",
      acceptedAnswer: { "@type": "Answer", text: "We serve the greater Charlotte, NC area." },
    },
  ],
};

const BREADCRUMB_ENTITY = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [{ "@type": "ListItem", position: 1, name: "Home" }],
};

// ---------------------------------------------------------------------------
// "Complete" / "strong" multi-page fixture builder
// ---------------------------------------------------------------------------

const ROOT = "https://strongsite.example.com";

interface PageSpec {
  path: string;
  label: string;
  h1: string;
  h2: string;
  h3: string;
  answer1: string;
  answer2: string;
  metaDescription: string;
  extraBody?: string;
  form?: { fieldCount: number; fields: string[] };
}

const FILLER_SENTENCE =
  "Our licensed and insured technicians bring years of hands-on experience to every appointment, " +
  "arriving on time, explaining the work clearly, and leaving the property clean when the job is done.";

function filler(minWords: number): string {
  const sentenceWords = FILLER_SENTENCE.split(/\s+/).length;
  const repeats = Math.ceil(minWords / sentenceWords) + 1;
  return Array(repeats).fill(FILLER_SENTENCE).join(" ");
}

function slugify(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const PAGE_SPECS: PageSpec[] = [
  {
    path: "",
    label: "Home",
    h1: "Charlotte's Most Trusted Home Services Team",
    h2: "What do we offer here?",
    h3: "Why choose our team?",
    answer1:
      "We provide expert local home repair, maintenance, and installation built around your schedule.",
    answer2:
      "Because we combine decades of experience, fast response times, and fair, transparent pricing.",
    metaDescription:
      "Licensed, insured home services in Charlotte, NC -- call today for a free quote from our trusted local team.",
    extraBody:
      "Use the navigation menu above to explore our services. " +
      "Call us today, schedule your free quote, or sign up online to get started -- we make it easy. " +
      "Read our client testimonials and see why homeowners across Charlotte trust our team. " +
      "Chat with us live for instant answers, any time. " +
      "Reach us any time at (704) 555-0134 or hello@strongsite.example.com. " +
      "We back every job with a 100% satisfaction guarantee, and our technicians are fully licensed and insured. " +
      "Our office is located at 123 Main Street, Charlotte, NC 28202. " +
      "Last updated: June 2026.",
  },
  {
    path: "/about",
    label: "About Us",
    h1: "About Our Family-Owned Home Services Company",
    h2: "Who are we?",
    h3: "What do we believe in?",
    answer1:
      "We're a family-owned home services company that has served Charlotte homeowners for over a decade.",
    answer2: "We believe in honest pricing, careful work, and treating every home like our own.",
    metaDescription:
      "Meet the family-owned team behind StrongSite Home Services and the values that guide every job we do.",
  },
  {
    path: "/services",
    label: "Our Services",
    h1: "Home Services We Proudly Offer",
    h2: "What services do we provide?",
    h3: "How do we handle every job?",
    answer1:
      "We handle everything from routine maintenance to full installations, all backed by our written guarantee.",
    answer2:
      "Every job starts with a clear estimate, a scheduled appointment, and a technician who explains the work.",
    metaDescription:
      "Explore the full range of home services offered by our licensed, insured Charlotte-based team.",
  },
  {
    path: "/pricing",
    label: "Pricing",
    h1: "Simple, Transparent Pricing for Every Job",
    h2: "How much does it cost?",
    h3: "Why is our pricing fair?",
    answer1: "Every quote is itemized up front, so you know the full cost before any work begins.",
    answer2: "We price every job the same way for every customer, with no hidden fees or surprise charges.",
    metaDescription:
      "See transparent, upfront pricing and request a free quote for your next home services project.",
  },
  {
    path: "/blog",
    label: "Blog",
    h1: "Tips and Guides From Our Home Services Team",
    h2: "What will you find here?",
    h3: "How often do we publish?",
    answer1: "You'll find practical, easy-to-follow guides for keeping your home in great shape year-round.",
    answer2: "Our team publishes new seasonal maintenance guides throughout the year.",
    metaDescription:
      "Read practical home maintenance tips and seasonal guides from our licensed Charlotte technicians.",
  },
  {
    path: "/blog/seasonal-maintenance-tips",
    label: "Seasonal Maintenance Tips",
    h1: "Seasonal Maintenance Tips for Every Homeowner",
    h2: "What should you check each season?",
    h3: "When should you call a professional?",
    answer1: "Each season brings its own checklist, from gutters in the fall to cooling systems in the summer.",
    answer2: "Call a professional any time a repair involves electrical, gas, or structural work.",
    metaDescription:
      "A season-by-season maintenance checklist from our licensed home services technicians in Charlotte.",
  },
  {
    path: "/contact",
    label: "Contact Us",
    h1: "Get in Touch With Our Team Today",
    h2: "How can you reach us?",
    h3: "What happens after you contact us?",
    answer1: "Call, email, or fill out the short form below and a real person will get back to you the same day.",
    answer2: "We'll schedule a free quote at a time that works for you, no obligation required.",
    metaDescription:
      "Contact our Charlotte home services team by phone, email, or our simple online contact form.",
    form: { fieldCount: 4, fields: ["name", "email", "phone", "message"] },
  },
  {
    path: "/thank-you",
    label: "Thank You",
    h1: "Thank You for Reaching Out to Us",
    h2: "What happens next?",
    h3: "Have another question?",
    answer1: "A member of our team will call or email you within one business day to confirm your free quote.",
    answer2: "Feel free to call us any time at (704) 555-0134 with additional questions.",
    metaDescription:
      "Thanks for contacting our team -- here's what to expect next from StrongSite Home Services.",
  },
  {
    path: "/privacy",
    label: "Privacy Policy",
    h1: "Our Commitment to Your Privacy",
    h2: "What information do we collect?",
    h3: "How do we protect your data?",
    answer1: "We only collect the contact details you provide when requesting a quote or reaching out to us.",
    answer2: "We store your information securely and never sell it to third parties.",
    metaDescription: "Read our privacy policy to see exactly how StrongSite Home Services handles your information.",
  },
  {
    path: "/terms",
    label: "Terms of Service",
    h1: "Terms of Service for Our Website",
    h2: "What do these terms cover?",
    h3: "How can you contact us about them?",
    answer1: "These terms cover how you may use our website and the services described on it.",
    answer2: "Email hello@strongsite.example.com any time with questions about these terms.",
    metaDescription: "Review the terms of service that govern the use of the StrongSite Home Services website.",
  },
];

interface MeshOptions {
  includeGbp: boolean;
  includeYoutube: boolean;
  includeSkipNav: boolean;
  includeFavicon: boolean;
  includeChat: boolean;
}

const COMPLETE_OPTS: MeshOptions = {
  includeGbp: true,
  includeYoutube: true,
  includeSkipNav: true,
  includeFavicon: true,
  includeChat: true,
};

function buildMeshLinks(root: string, specs: PageSpec[], selfPath: string, opts: MeshOptions): CrawledPage["links"] {
  const navLinks: CrawledPage["links"] = specs
    .filter((s) => s.path !== selfPath)
    .map((s) => ({
      href: `${root}${s.path}`,
      text: s.label,
      isInternal: true,
      location: "header" as const,
    }));

  const socialLinks: CrawledPage["links"] = [
    { href: "https://facebook.com/strongsite", text: "Facebook", isInternal: false, location: "footer" },
    { href: "https://instagram.com/strongsite", text: "Instagram", isInternal: false, location: "footer" },
    { href: "https://linkedin.com/company/strongsite", text: "LinkedIn", isInternal: false, location: "footer" },
    { href: "https://x.com/strongsite", text: "Twitter/X", isInternal: false, location: "footer" },
  ];
  if (opts.includeYoutube) {
    socialLinks.push({ href: "https://youtube.com/@strongsite", text: "YouTube", isInternal: false, location: "footer" });
  }

  const extras: CrawledPage["links"] = [];
  if (opts.includeSkipNav) {
    extras.push({ href: "#main-content", text: "Skip to main content", isInternal: true, location: "header" });
  }
  if (opts.includeGbp) {
    extras.push({
      href: "https://www.google.com/maps/place/StrongSite+HQ",
      text: "Find us on Google Maps",
      isInternal: false,
      location: "footer",
    });
  }

  return [...extras, ...navLinks, ...socialLinks];
}

function buildPage(root: string, spec: PageSpec, allSpecs: PageSpec[], opts: MeshOptions): CrawledPage {
  const url = `${root}${spec.path}`;
  const isHome = spec.path === "";

  const bodyParts = [spec.h1, `${spec.h2} ${spec.answer1}`, `${spec.h3} ${spec.answer2}`];
  if (spec.extraBody) bodyParts.push(spec.extraBody);
  bodyParts.push(filler(520));
  const bodyText = bodyParts.join("\n\n");

  const headings = [
    { level: 1, text: spec.h1 },
    { level: 2, text: spec.h2 },
    { level: 3, text: spec.h3 },
  ];

  const links = buildMeshLinks(root, allSpecs, spec.path, opts);

  const images: CrawledPage["images"] = isHome
    ? [
        {
          src: `${root}/images/hero.webp`,
          alt: "Technician arriving at a customer's home",
          srcset: `${root}/images/hero-400.webp 400w, ${root}/images/hero-800.webp 800w`,
        },
        { src: `${root}/images/team.jpg`, alt: "Our technicians smiling in front of the service van" },
        { src: `${root}/images/logo.svg`, alt: "StrongSite Home Services logo" },
      ]
    : [{ src: `${root}/images/${slugify(spec.label)}.webp`, alt: `${spec.label} page photo` }];

  const headLinks: CrawledPage["headLinks"] = [{ rel: "canonical", href: url }];
  if (isHome) {
    if (opts.includeFavicon) headLinks.push({ rel: "icon", href: `${root}/favicon.ico` });
    headLinks.push({ rel: "preload", href: `${root}/_next/static/media/inter-abc123.woff2` });
  }

  const structuredData: unknown[] = [ORG_ENTITY];
  if (isHome) structuredData.push(FAQ_ENTITY, BREADCRUMB_ENTITY);

  const ogTags: Record<string, string> = isHome
    ? {
        "og:title": "StrongSite Home Services | Charlotte, NC",
        "og:description": "Licensed, insured home services trusted across Charlotte.",
        "og:image": `${root}/images/og-cover.jpg`,
        "og:site_name": "StrongSite Home Services",
      }
    : {};

  const forms: CrawledPage["forms"] = spec.form
    ? [{ action: `${url}/submit`, method: "post", fieldCount: spec.form.fieldCount, fields: spec.form.fields }]
    : [];

  const buttons: CrawledPage["buttons"] = isHome ? [{ text: "Get Started Today", type: "button" }] : [];

  return {
    url,
    title: `${spec.label} | StrongSite Home Services`,
    metaDescription: spec.metaDescription,
    headings,
    bodyText,
    links,
    headLinks,
    images,
    forms,
    iframes: [],
    buttons,
    ogTags,
    structuredData,
    statusCode: 200,
  };
}

function buildPages(opts: MeshOptions): CrawledPage[] {
  return PAGE_SPECS.map((spec) => buildPage(ROOT, spec, PAGE_SPECS, opts));
}

function idealPsi(url: string): PSIMetrics {
  return {
    url,
    scores: { performance: 0.97, accessibility: 0.98, seo: 1, bestPractices: 0.96 },
    coreWebVitals: { lcp: 1800, tbt: 80, cls: 0.02, fcp: 900, speedIndex: 1600, ttfb: 200 },
    audits: [
      {
        id: "total-byte-weight",
        title: "Total byte weight",
        score: 0.9,
        displayValue: "800 KB",
        description: "Total size of all resources loaded.",
      },
    ],
  };
}

function idealPsiMetrics(): PSIMetrics[] {
  return [idealPsi(`${ROOT}/`), idealPsi(`${ROOT}/about`)];
}

// ---------------------------------------------------------------------------
// Weak-site fixture: a bare, broken 3-page site
// ---------------------------------------------------------------------------

const WEAK_ROOT = "http://weaksite.example.com";

function buildWeakPages(): CrawledPage[] {
  return [
    {
      url: `${WEAK_ROOT}/`,
      title: "Home",
      metaDescription: "",
      headings: [],
      bodyText: "Welcome to our site.",
      links: [{ href: `${WEAK_ROOT}/about`, text: "about", isInternal: true, location: "body" }],
      headLinks: [],
      images: [],
      forms: [],
      iframes: [],
      buttons: [],
      ogTags: {},
      structuredData: [],
      statusCode: 200,
    },
    {
      url: `${WEAK_ROOT}/about`,
      title: "Home",
      metaDescription: "",
      headings: [],
      bodyText: "We are a company.",
      links: [],
      headLinks: [],
      images: [],
      forms: [],
      iframes: [],
      buttons: [],
      ogTags: {},
      structuredData: [],
      statusCode: 200,
    },
    {
      url: `${WEAK_ROOT}/contact`,
      title: "",
      metaDescription: "",
      headings: [],
      bodyText: "",
      links: [],
      headLinks: [],
      images: [],
      forms: [],
      iframes: [],
      buttons: [],
      ogTags: {},
      structuredData: [],
      statusCode: 404,
    },
  ];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("calibration: fully complete fixture", () => {
  it("scores exactly 100 in every category when every signal is satisfied", async () => {
    installFetchStub({ robotsBody: ALLOW_ALL_ROBOTS, sitemapOk: true, llmsOk: true });

    const result = await runScoring({
      pages: buildPages(COMPLETE_OPTS),
      psiMetrics: idealPsiMetrics(),
      screenshots: [],
      rootUrl: ROOT,
    });

    for (const cat of result.categories) {
      expect(cat.score, `${cat.category_id} (${cat.findings.map((f) => f.code).join(", ")})`).toBe(100);
    }
    expect(result.overall_score).toBe(100);
    expect(result.overall_severity).toBe("strong");
  });
});

describe("calibration: strong (near-perfect) site", () => {
  it("scores at least 95 overall for a realistic, well-built site", async () => {
    installFetchStub({ robotsBody: ALLOW_ALL_ROBOTS, sitemapOk: true, llmsOk: true });

    const strongOpts: MeshOptions = {
      includeGbp: false,
      includeYoutube: false,
      includeSkipNav: false,
      includeFavicon: false,
      includeChat: false,
    };

    const result = await runScoring({
      pages: buildPages(strongOpts),
      psiMetrics: idealPsiMetrics(),
      screenshots: [],
      rootUrl: ROOT,
    });

    expect(result.overall_score).toBeGreaterThanOrEqual(95);
  });
});

describe("calibration: weak site", () => {
  it("scores 40 or below overall, with a coherent negative story across categories", async () => {
    installFetchStub({ robotsBody: null, sitemapOk: false, llmsOk: false });

    const result = await runScoring({
      pages: buildWeakPages(),
      psiMetrics: [],
      screenshots: [],
      rootUrl: WEAK_ROOT,
    });

    expect(result.overall_score).toBeLessThanOrEqual(40);

    // A coherent negative story: real problems show up across the board, not
    // just in one corner of the site.
    const categoriesWithFindings = result.categories.filter((c) => c.findings.length > 0);
    expect(categoriesWithFindings.length).toBeGreaterThanOrEqual(6);
  });
});

describe("calibration: pure AEO scorer (deterministic, no fetch)", () => {
  it("scores 100 when every AEO signal is present", () => {
    const homepage: AeoPage = {
      url: `${ROOT}/`,
      headings: [
        { level: 1, text: "Charlotte's Most Trusted Home Services Team" },
        { level: 2, text: "What services do we offer?" },
        { level: 3, text: "Why should you choose us?" },
      ],
      bodyText:
        "Charlotte's Most Trusted Home Services Team\n\n" +
        "What services do we offer? We provide expert repair, maintenance, and installation for homes across Charlotte.\n\n" +
        "Why should you choose us? Because our licensed technicians are fast, fair, and fully insured.\n\n" +
        "Last updated: June 2026. " +
        filler(300),
      structuredData: [ORG_ENTITY, FAQ_ENTITY],
      metaDescription: "Licensed, insured home services in Charlotte, NC.",
      ogTags: { "og:title": "StrongSite Home Services", "og:description": "Trusted local home services." },
    };

    const about: AeoPage = {
      url: `${ROOT}/about`,
      headings: [{ level: 1, text: "About Our Team" }],
      bodyText: "About Our Team\n\n" + filler(300),
      structuredData: [ORG_ENTITY],
      metaDescription: "About our licensed home services team.",
      ogTags: {},
    };

    const result = scoreAeo({ pages: [homepage, about], blockedAiBots: [], hasLlmsTxt: true });

    expect(result.findings).toEqual([]);
    expect(result.score).toBe(100);
  });

  it("scores low for a page with none of the AEO signals", () => {
    const bare: AeoPage = {
      url: `${WEAK_ROOT}/`,
      headings: [],
      bodyText: "Welcome to our site.",
      structuredData: [],
      metaDescription: "",
      ogTags: {},
    };

    const result = scoreAeo({ pages: [bare], blockedAiBots: ["GPTBot"], hasLlmsTxt: false });

    expect(result.score).toBeLessThanOrEqual(40);
    expect(result.findings.length).toBeGreaterThan(5);
  });
});
