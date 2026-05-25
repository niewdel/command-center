// scripts/smoke-reports.mjs
//
// Renders the redesigned audit report, fix plan, and monthly SEO email
// against realistic stub data for niewdel.com, then sends all four
// (including the "heads-down" SEO variant) to niewdel@gmail.com via Resend.
//
// Usage:
//   node --env-file=.env.local scripts/smoke-reports.mjs

import { generateHtmlReport } from "../src/lib/audit/report-html.ts";
import { generateFixPlanHtml } from "../src/lib/audit/report-fix-html.ts";
import { renderMonthlyReportEmail } from "../src/lib/seo/monthly-report-email.ts";
import { sendEmail } from "../src/lib/email/resend.ts";

const TO = "niewdel@gmail.com";

// ── Audit stub for niewdel.com ─────────────────────────────────────────────

const auditResult = {
  url: "https://niewdel.com",
  siteName: "Niewdel",
  auditDate: new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }),
  overall_score: 58,
  overall_severity: "moderate",
  overall_headline: "The site looks sharp but it's leaving leads on the table.",
  overall_narrative:
    "Visual design and brand presence are solid. The biggest gaps are around getting found in search, loading speed on mobile, and clear next steps for visitors who want to talk. A focused pass on these three areas would move the score from the mid-50s into the mid-80s.",
  pagesCrawled: 6,
  categories: [
    {
      category_id: "seo",
      category_name: "Search Visibility",
      score: 42,
      severity: "serious",
      headline: "Google doesn't have enough to work with.",
      narrative:
        "Page titles and descriptions are missing on several pages, and the homepage doesn't tell search engines what Niewdel actually does.",
      findings: [
        "Homepage title tag is generic and doesn't mention what Niewdel does.",
        "Four pages have no meta description, so Google writes its own.",
        "No schema markup, which makes the site harder to feature in rich results.",
      ],
    },
    {
      category_id: "performance",
      category_name: "Site Speed",
      score: 51,
      severity: "moderate",
      headline: "Mobile feels slow on a real phone connection.",
      narrative:
        "Pages take just under four seconds to feel ready on mobile. Most of that is large images and a few scripts loading before the page can paint.",
      findings: [
        "Hero images aren't compressed for the web.",
        "JavaScript loads before the page can show content.",
        "No image lazy-loading on long pages.",
      ],
    },
    {
      category_id: "cta",
      category_name: "Clear Next Steps",
      score: 55,
      severity: "moderate",
      headline: "Visitors don't always know what to do next.",
      narrative:
        "The site has multiple calls to action competing for attention. The 'book a call' option isn't obvious above the fold on key pages.",
      findings: [
        "Three different CTAs on the homepage (Book, Email, Contact form).",
        "The primary CTA isn't visible until you scroll on mobile.",
      ],
    },
    {
      category_id: "content",
      category_name: "Content Strength",
      score: 68,
      severity: "acceptable",
      headline: "Copy is clear but thin on proof.",
      narrative:
        "The messaging is direct and the brand voice is consistent. Adding case studies and concrete results would lift confidence.",
      findings: [
        "No case studies or named client outcomes.",
        "Service pages don't list typical deliverables or timelines.",
      ],
    },
    {
      category_id: "trust",
      category_name: "Trust Signals",
      score: 64,
      severity: "moderate",
      headline: "Solid foundation, missing the social proof.",
      narrative:
        "Branding, design polish, and a clear About story all help. There's no client list, testimonial, or third-party review surface.",
      findings: [
        "No client logos or testimonials on the homepage.",
        "Contact page doesn't show a physical address or hours.",
      ],
    },
    {
      category_id: "usability",
      category_name: "Ease of Use",
      score: 76,
      severity: "acceptable",
      headline: "The site reads well and gets out of the way.",
      narrative:
        "Navigation is clean, pages are scannable, and the mobile experience holds up. A few small tweaks would push this further.",
      findings: [
        "Footer navigation duplicates header links rather than offering deeper paths.",
      ],
    },
    {
      category_id: "visual-design",
      category_name: "Visual Design",
      score: 84,
      severity: "strong",
      headline: "The brand looks the part.",
      narrative:
        "Typography, color, and spacing are confident. Visual identity is consistent across pages.",
      findings: [],
    },
    {
      category_id: "conversion",
      category_name: "Conversion",
      score: 50,
      severity: "moderate",
      headline: "There's a sales funnel here, but it's leaky.",
      narrative:
        "The homepage drives toward a single goal, but mid-funnel pages don't reinforce the offer. The contact form is long.",
      findings: [
        "Contact form has nine fields when three would do.",
        "No urgency or incentive on the booking CTA.",
      ],
    },
  ],
  psiMetrics: [],
  screenshots: [],
};

// ── Fix plan derived from the audit (we keep this hand-rolled so the smoke
//    test isn't gated on the live category-to-fix translator). ──────────────

const fixPlan = {
  url: "https://niewdel.com",
  siteName: "Niewdel",
  auditDate: auditResult.auditDate,
  currentScore: 58,
  projectedScore: 87,
  quickWins: [
    {
      finding: "Homepage title doesn't mention what Niewdel does.",
      fix: "Rewrite the homepage title to lead with the offer.",
      priority: "critical",
      impact: "Sets the tone for every search appearance.",
      difficulty: "easy",
      timeEstimate: "30 minutes",
    },
    {
      finding: "Four pages have no meta description.",
      fix: "Write a one-line description per page.",
      priority: "high",
      impact: "Improves click-through from search results.",
      difficulty: "easy",
      timeEstimate: "1 hour",
    },
    {
      finding: "Hero images load uncompressed.",
      fix: "Compress hero images and serve modern formats.",
      priority: "high",
      impact: "Cuts mobile load time by roughly a second.",
      difficulty: "moderate",
      timeEstimate: "2 hours",
    },
    {
      finding: "Contact form has nine fields.",
      fix: "Drop to three fields plus an optional message.",
      priority: "high",
      impact: "More people will actually start the form.",
      difficulty: "easy",
      timeEstimate: "45 minutes",
    },
    {
      finding: "No client logos or testimonials on the homepage.",
      fix: "Add a logo strip plus one rotating testimonial.",
      priority: "medium",
      impact: "Visitors trust the brand faster.",
      difficulty: "moderate",
      timeEstimate: "2 hours",
    },
  ],
  categories: [
    {
      category_id: "seo",
      category_name: "Search Visibility",
      currentScore: 42,
      targetScore: 82,
      fixes: [
        {
          finding: "Homepage title is generic.",
          fix: "Lead with the offer and the city.",
          priority: "critical",
          impact: "Better signal to Google.",
          difficulty: "easy",
          timeEstimate: "30 minutes",
        },
        {
          finding: "Meta descriptions missing on four pages.",
          fix: "Write a one-line description per page.",
          priority: "high",
          impact: "Better click-through from search.",
          difficulty: "easy",
          timeEstimate: "1 hour",
        },
        {
          finding: "No schema markup on services or local pages.",
          fix: "Add Organization and Service schema.",
          priority: "medium",
          impact: "Eligibility for rich results.",
          difficulty: "moderate",
          timeEstimate: "3 hours",
        },
      ],
    },
    {
      category_id: "performance",
      category_name: "Site Speed",
      currentScore: 51,
      targetScore: 84,
      fixes: [
        {
          finding: "Hero images aren't compressed.",
          fix: "Compress and serve modern formats.",
          priority: "high",
          impact: "Cuts mobile load time meaningfully.",
          difficulty: "moderate",
          timeEstimate: "2 hours",
        },
        {
          finding: "Scripts block the first paint.",
          fix: "Defer non-critical JavaScript.",
          priority: "high",
          impact: "Pages feel ready sooner.",
          difficulty: "moderate",
          timeEstimate: "2 hours",
        },
        {
          finding: "No image lazy-loading below the fold.",
          fix: "Lazy-load images on long pages.",
          priority: "medium",
          impact: "Less data on initial load.",
          difficulty: "easy",
          timeEstimate: "1 hour",
        },
      ],
    },
    {
      category_id: "cta",
      category_name: "Clear Next Steps",
      currentScore: 55,
      targetScore: 85,
      fixes: [
        {
          finding: "Three competing CTAs on the homepage.",
          fix: "Pick one primary CTA, demote the rest.",
          priority: "high",
          impact: "More booked calls.",
          difficulty: "easy",
          timeEstimate: "45 minutes",
        },
        {
          finding: "Primary CTA not visible on mobile above the fold.",
          fix: "Pin the button to the hero band.",
          priority: "high",
          impact: "Conversions on mobile.",
          difficulty: "easy",
          timeEstimate: "1 hour",
        },
      ],
    },
    {
      category_id: "trust",
      category_name: "Trust Signals",
      currentScore: 64,
      targetScore: 88,
      fixes: [
        {
          finding: "No logos or testimonials on the homepage.",
          fix: "Add a logo strip and one testimonial.",
          priority: "medium",
          impact: "Faster trust on first visit.",
          difficulty: "moderate",
          timeEstimate: "2 hours",
        },
        {
          finding: "Contact page missing address and hours.",
          fix: "Add a small location and hours block.",
          priority: "low",
          impact: "Looks more legitimate.",
          difficulty: "easy",
          timeEstimate: "20 minutes",
        },
      ],
    },
  ],
};

// ── Monthly SEO data: a realistic mixed month (wins variant) ───────────────

const seoDataMixed = {
  client: {
    id: "smoke-niewdel",
    name: "Niewdel",
    domain: "niewdel.com",
    period_label: new Date().toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    }),
    generated_at: new Date().toISOString(),
  },
  range: "30d",
  health: {
    overall_score: 74,
    overall_delta: 6,
    technical: { current: 78, delta: 4, history: [] },
    onpage: { current: 71, delta: 8, history: [] },
    lighthouse_mobile: { current: 64, delta: 3, history: [] },
    lighthouse_desktop: { current: 88, delta: 2, history: [] },
    open_issues: { total: 12, critical: 1, high: 3, medium: 5, low: 3 },
  },
  traffic: {
    sessions: { current: 1842, delta: 318 },
    organic_sessions: { current: 1104, delta: 240 },
    users: { current: 1421, delta: 211 },
    pages_per_session: { current: 2.4, delta: 0.3 },
    sources: { search: 60, direct: 22, referral: 10, social: 6, other: 2 },
    period_start: new Date(Date.now() - 30 * 86400000).toISOString(),
    period_end: new Date().toISOString(),
  },
  keywords: {
    ranking_count: 31,
    tracked_count: 48,
    avg_rank: 18.4,
    total_search_volume: 14_500,
    top_movers_up: [
      { keyword: "charlotte software studio", rank: 6, prior_rank: 14, delta: -8 },
      { keyword: "custom workflow automation", rank: 4, prior_rank: 9, delta: -5 },
      { keyword: "ai integration consultant nc", rank: 11, prior_rank: 19, delta: -8 },
    ],
    top_movers_down: [
      // Will be suppressed by the new renderer
      { keyword: "small business software", rank: 28, prior_rank: 22, delta: 6 },
    ],
  },
  top_pages: [
    { path: "/", sessions: 612, pct_of_total: 33 },
    { path: "/services", sessions: 388, pct_of_total: 21 },
    { path: "/about", sessions: 244, pct_of_total: 13 },
  ],
  issues: {
    open_top: [],
    resolved: [
      { title: "Fixed slow-loading hero image on the homepage." },
      { title: "Added schema markup to the services page." },
      { title: "Cleaned up duplicate meta descriptions across the site." },
    ],
  },
  history: [],
  ai_summary:
    "Search traffic climbed about 28 percent this period, mostly from local searches finding the services page. The site is loading faster on mobile after we compressed the hero images. Next month we'll focus on getting the homepage ranking for two more high-intent phrases.",
};

// ── Monthly SEO data: an all-negative month to trigger heads-down variant ──

const seoDataHeadsDown = {
  ...seoDataMixed,
  client: { ...seoDataMixed.client, name: "Niewdel (heads-down variant)" },
  health: {
    ...seoDataMixed.health,
    overall_score: 62,
    overall_delta: -3,
    technical: { current: 70, delta: -2, history: [] },
    onpage: { current: 59, delta: -1, history: [] },
    lighthouse_mobile: { current: 58, delta: -4, history: [] },
    lighthouse_desktop: { current: 81, delta: 0, history: [] },
  },
  traffic: {
    ...seoDataMixed.traffic,
    sessions: { current: 1320, delta: -180 },
    organic_sessions: { current: 822, delta: -94 },
    users: { current: 1004, delta: -120 },
    pages_per_session: { current: 2.1, delta: -0.1 },
  },
  keywords: {
    ...seoDataMixed.keywords,
    top_movers_up: [],
    top_movers_down: [
      { keyword: "small business software", rank: 28, prior_rank: 22, delta: 6 },
      { keyword: "workflow tools", rank: 19, prior_rank: 14, delta: 5 },
    ],
  },
  issues: { open_top: [], resolved: [] },
  ai_summary:
    "This was a quieter month while search algorithms shifted. We've laid groundwork on three pages that will surface in metrics over the next few weeks.",
};

// ── Send ────────────────────────────────────────────────────────────────────

async function main() {
  const reports = [
    {
      subject: "[Smoke] Audit Report, Niewdel",
      html: generateHtmlReport(auditResult),
      label: "audit",
    },
    {
      subject: "[Smoke] Fix Plan, Niewdel",
      html: generateFixPlanHtml(fixPlan),
      label: "fix plan",
    },
    {
      subject: "[Smoke] Monthly SEO, Niewdel (wins variant)",
      html: renderMonthlyReportEmail(seoDataMixed),
      label: "monthly SEO (wins)",
    },
    {
      subject: "[Smoke] Monthly SEO, Niewdel (heads-down variant)",
      html: renderMonthlyReportEmail(seoDataHeadsDown),
      label: "monthly SEO (heads-down)",
    },
  ];

  for (const r of reports) {
    try {
      const result = await sendEmail({
        to: TO,
        subject: r.subject,
        html: r.html,
      });
      console.log(`sent ${r.label}: ${result.id}`);
    } catch (err) {
      console.error(`failed ${r.label}:`, err.message ?? err);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
