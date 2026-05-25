// Renders the monthly SEO email HTML with realistic Franky's Detailing data
// and saves a PNG screenshot. Used as supporting material for the Google
// Ads API Basic Access application so reviewers can see exactly what the
// API data goes into.
//
// Output: /tmp/seo-report-screenshot.png

import { chromium } from "playwright";
import { renderMonthlyReportEmail } from "../src/lib/seo/monthly-report-email.ts";
import { writeFileSync } from "node:fs";

const data = {
  client: {
    id: "smoke-franky",
    name: "Franky's Detailing",
    domain: "frankysdetailing.com",
    period_label: "May 2026",
    generated_at: new Date().toISOString(),
  },
  range: "30d",
  health: {
    overall_score: 78,
    overall_delta: 5,
    technical: { current: 82, delta: 4, history: [] },
    onpage: { current: 75, delta: 6, history: [] },
    lighthouse_mobile: { current: 71, delta: 3, history: [] },
    lighthouse_desktop: { current: 88, delta: 2, history: [] },
    open_issues: { total: 9, critical: 1, high: 2, medium: 4, low: 2 },
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
    avg_rank: 14.4,
    total_search_volume: 14500,
    top_movers_up: [
      { keyword: "car detailing charlotte", rank: 4, prior_rank: 11, delta: -7 },
      { keyword: "mobile detailing service", rank: 6, prior_rank: 12, delta: -6 },
      { keyword: "ceramic coating nc", rank: 9, prior_rank: 17, delta: -8 },
    ],
    top_movers_down: [
      { keyword: "wash and wax near me", rank: 22, prior_rank: 18, delta: 4 },
    ],
  },
  top_pages: [
    { path: "Home", sessions: 1450, pct_of_total: 79 },
    { path: "/services/detail-packages", sessions: 188, pct_of_total: 10 },
    { path: "/contact", sessions: 95, pct_of_total: 5 },
    { path: "/mobile-car-detailing-services", sessions: 71, pct_of_total: 4 },
  ],
  issues: {
    open_top: [
      {
        severity: "high",
        title: "LCP above target on /services/detail-packages",
        page_url: "https://frankysdetailing.com/services/detail-packages",
      },
    ],
    resolved: [
      { title: "Fixed slow-loading hero image on the homepage." },
      { title: "Added schema markup to the services page." },
    ],
  },
  ads: {
    state: "ok",
    metrics: {
      period_start: new Date(Date.now() - 30 * 86400000)
        .toISOString()
        .slice(0, 10),
      period_end: new Date().toISOString().slice(0, 10),
      clicks: 412,
      impressions: 18402,
      cost: 1284,
      ctr: 0.0224,
      avg_cpc: 3.11,
      conversions: 18.5,
      cost_per_conversion: 69.4,
      top_campaigns: [
        { name: "Detailing — Charlotte Search", cost: 720, clicks: 240, conversions: 11 },
        { name: "Detailing — Performance Max", cost: 420, clicks: 132, conversions: 6.5 },
        { name: "Brand", cost: 144, clicks: 40, conversions: 1 },
      ],
    },
  },
  history: [],
  ai_summary:
    "Organic search traffic climbed about 28 percent this period, mostly from local searches finding the services page. Paid campaigns drove 412 additional clicks at a $3.11 average cost per click. Mobile page speed is the next area we are working on.",
};

const html = renderMonthlyReportEmail(data);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 700, height: 1200 } });
await page.setContent(html, { waitUntil: "networkidle" });
const fullHeight = await page.evaluate(() => document.body.scrollHeight);
await page.setViewportSize({ width: 700, height: fullHeight });
const out = "/tmp/seo-report-screenshot.png";
await page.screenshot({ path: out, fullPage: true });
await browser.close();

// Also save the raw HTML for inspection
writeFileSync("/tmp/seo-report-screenshot.html", html);
console.log("saved:", out);
console.log("html:", "/tmp/seo-report-screenshot.html");
