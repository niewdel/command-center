// Builds the Google Ads API Basic Access application PDF + an ads-only
// screenshot of the monthly client report. Both saved into ~/Documents/Niewdel.
//
// Design notes:
//   - Tool is referred to as "Niewdel App", per operator preference.
//   - Page is full-bleed Paper (no white margins). Achieved by setting
//     @page { margin: 0 } and applying inner padding to the content.
//   - Content is trimmed to what the form template actually asks for:
//     Company Name, Business Model, Tool Access/Use, Tool Design,
//     API Services Called, Tool Mockups. No extra summary table.

import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const PAPER = "#F5F1EA";
const PAPER_RAISED = "#FBF8F2";
const PAPER_EDGE = "#E3DDD2";
const INK = "#1A1410";
const INK_SOFT = "#665E54";
const INK_FAINT = "#8E867C";
const RUST = "#C84B31";
const RUST_HOT = "#E36548";
const SAGE = "#5C7F4F";

const FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
const MONO =
  "'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace";

// Output directory: ~/Documents/Niewdel
const OUT_DIR = path.join(os.homedir(), "Documents", "Niewdel");
const PDF_PATH = path.join(OUT_DIR, "niewdel-google-ads-api-application.pdf");
const ADS_SHOT_PATH = path.join(OUT_DIR, "niewdel-app-google-ads-mockup.png");

// ── 1. Render an ads-only screenshot ────────────────────────────────────────
// Standalone HTML showing exactly what the API's data gets rendered into,
// so reviewers can see we capture: spend, clicks, impressions, CTR,
// conversions, cost per conversion, top campaigns.

const sample = {
  client: { name: "Franky's Detailing", domain: "frankysdetailing.com", period_label: "May 2026" },
  ads: {
    period_start: "2026-04-25",
    period_end: "2026-05-25",
    clicks: 412,
    impressions: 18402,
    cost: 1284,
    ctr: 0.0224,
    avg_cpc: 3.11,
    conversions: 18.5,
    cost_per_conversion: 69.4,
    top_campaigns: [
      { name: "Detailing, Charlotte Search", cost: 720, clicks: 240, conversions: 11 },
      { name: "Detailing, Performance Max", cost: 420, clicks: 132, conversions: 6.5 },
      { name: "Brand", cost: 144, clicks: 40, conversions: 1 },
    ],
  },
};

const fmtUsd = (n) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
const fmtNum = (n) => n.toLocaleString("en-US");
const fmtPct = (n) => `${(n * 100).toFixed(1)}%`;

const adsHtml = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: ${FONT};
    background: ${PAPER};
    color: ${INK};
    padding: 36px 32px;
    width: 640px;
  }
  .header { margin-bottom: 24px; }
  .tag {
    font-family: ${MONO};
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.22em;
    color: ${RUST};
    margin-bottom: 10px;
  }
  .client { font-size: 24px; font-weight: 700; letter-spacing: -0.015em; color: ${INK}; }
  .domain { font-size: 13px; color: ${INK_SOFT}; margin-top: 4px; }

  .section-tag {
    font-family: ${MONO};
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.22em;
    color: ${RUST};
    margin-bottom: 14px;
  }

  .hero {
    background: ${PAPER_RAISED};
    border: 1px solid ${PAPER_EDGE};
    border-radius: 10px;
    padding: 18px;
    margin-bottom: 12px;
  }
  .hero .label {
    font-family: ${MONO};
    font-size: 10px;
    font-weight: 600;
    color: ${INK_SOFT};
    text-transform: uppercase;
    letter-spacing: 0.18em;
    margin-bottom: 4px;
  }
  .hero .value {
    font-size: 36px;
    font-weight: 700;
    letter-spacing: -0.025em;
    font-variant-numeric: tabular-nums;
  }
  .hero .period {
    font-family: ${MONO};
    font-size: 11px;
    color: ${INK_FAINT};
    letter-spacing: 0.04em;
    margin-top: 4px;
  }

  .row3, .row2 { display: flex; gap: 8px; margin-bottom: 12px; }
  .card {
    flex: 1;
    background: ${PAPER_RAISED};
    border: 1px solid ${PAPER_EDGE};
    border-radius: 10px;
    padding: 14px;
  }
  .card .label {
    font-family: ${MONO};
    font-size: 10px;
    font-weight: 600;
    color: ${INK_SOFT};
    text-transform: uppercase;
    letter-spacing: 0.18em;
    margin-bottom: 4px;
  }
  .card .value {
    font-size: 22px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .top {
    margin-top: 10px;
  }
  .top-label {
    font-family: ${MONO};
    font-size: 10px;
    font-weight: 600;
    color: ${INK_SOFT};
    text-transform: uppercase;
    letter-spacing: 0.18em;
    margin-bottom: 10px;
  }
  table { width: 100%; border-collapse: collapse; }
  th {
    text-align: left;
    font-family: ${MONO};
    font-size: 10px;
    font-weight: 600;
    color: ${INK_SOFT};
    text-transform: uppercase;
    letter-spacing: 0.18em;
    padding: 0 0 6px 0;
  }
  th.right, td.right { text-align: right; }
  td {
    padding: 10px 0;
    border-top: 1px solid ${PAPER_EDGE};
    font-size: 13px;
    color: ${INK};
    font-variant-numeric: tabular-nums;
  }
</style>
</head>
<body>
  <div class="header">
    <div class="tag">SEO Report · ${sample.client.period_label}</div>
    <div class="client">${sample.client.name}</div>
    <div class="domain">${sample.client.domain}</div>
  </div>

  <div class="section-tag">07 · Google Ads</div>

  <div class="hero">
    <div class="label">Spend</div>
    <div class="value">${fmtUsd(sample.ads.cost)}</div>
    <div class="period">${sample.ads.period_start} – ${sample.ads.period_end}</div>
  </div>

  <div class="row3">
    <div class="card"><div class="label">Clicks</div><div class="value">${fmtNum(sample.ads.clicks)}</div></div>
    <div class="card"><div class="label">Impressions</div><div class="value">${fmtNum(sample.ads.impressions)}</div></div>
    <div class="card"><div class="label">CTR</div><div class="value">${fmtPct(sample.ads.ctr)}</div></div>
  </div>

  <div class="row2">
    <div class="card"><div class="label">Conversions</div><div class="value">${sample.ads.conversions.toFixed(1)}</div></div>
    <div class="card"><div class="label">Cost / Conversion</div><div class="value">${fmtUsd(sample.ads.cost_per_conversion)}</div></div>
  </div>

  <div class="top">
    <div class="top-label">Top Campaigns</div>
    <table>
      <thead>
        <tr><th>Campaign</th><th class="right">Spend</th><th class="right">Clicks</th></tr>
      </thead>
      <tbody>
        ${sample.ads.top_campaigns.map((c) => `
        <tr>
          <td>${c.name}</td>
          <td class="right">${fmtUsd(c.cost)}</td>
          <td class="right">${fmtNum(c.clicks)}</td>
        </tr>`).join("")}
      </tbody>
    </table>
  </div>
</body>
</html>`;

const browser = await chromium.launch();
{
  const page = await browser.newPage({ viewport: { width: 700, height: 1000 } });
  await page.setContent(adsHtml, { waitUntil: "networkidle" });
  const h = await page.evaluate(() => document.body.scrollHeight);
  await page.setViewportSize({ width: 700, height: h });
  await page.screenshot({ path: ADS_SHOT_PATH, fullPage: true });
}

// ── 2. Build the PDF ────────────────────────────────────────────────────────

const screenshotB64 = readFileSync(ADS_SHOT_PATH).toString("base64");

const pdfHtml = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<style>
  /* Full-bleed: no page margin, paper background paints to the edge of
     the sheet. Inner padding on the doc provides the visual gutter. */
  @page { size: Letter; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    background: ${PAPER};
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  body {
    font-family: ${FONT};
    color: ${INK};
    line-height: 1.55;
    font-size: 11pt;
  }
  /* Each .page is a discrete page with its own internal padding, so the
     top gutter applies on every page (not just page 1 like it does with a
     single doc-wrapper). page-break-after forces a fresh page between
     them; the last page's auto leaves Chromium to stop. */
  .page {
    padding: 0.6in 0.7in;
    page-break-after: always;
    /* Bias toward filling the sheet so the Paper background paints
       edge-to-edge even when content is short. */
    min-height: calc(11in - 0.01pt);
  }
  .page:last-child { page-break-after: auto; }

  .tag {
    font-family: ${MONO};
    font-size: 9pt;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.22em;
    color: ${RUST};
    margin-bottom: 10pt;
  }
  h1 {
    font-size: 24pt;
    font-weight: 700;
    line-height: 1.05;
    letter-spacing: -0.02em;
    margin-bottom: 6pt;
    color: ${INK};
  }
  .header-meta {
    font-size: 10pt;
    color: ${INK_SOFT};
    border-bottom: 1px solid ${PAPER_EDGE};
    padding-bottom: 16pt;
    margin-bottom: 22pt;
  }

  section { margin-bottom: 20pt; page-break-inside: avoid; }
  section .label {
    font-family: ${MONO};
    font-size: 9pt;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.22em;
    color: ${RUST};
    margin-bottom: 8pt;
  }
  section p {
    font-size: 11pt;
    color: ${INK};
    line-height: 1.6;
    /* Avoid single-word "runts" on the last line of a paragraph. */
    text-wrap: pretty;
  }
  section p + p { margin-top: 8pt; }

  h1 { text-wrap: balance; }
  .header-meta { text-wrap: pretty; }
  .mockup .caption { text-wrap: pretty; }

  pre.code {
    font-family: ${MONO};
    font-size: 9.5pt;
    line-height: 1.55;
    background: ${PAPER_RAISED};
    border: 1px solid ${PAPER_EDGE};
    border-radius: 6pt;
    padding: 12pt 14pt;
    color: ${INK};
    white-space: pre-wrap;
    margin-top: 8pt;
  }

  .mockup { margin-top: 18pt; }
  .mockup .label { margin-bottom: 4pt; }
  .mockup .caption {
    font-size: 10pt;
    color: ${INK_SOFT};
    margin-bottom: 14pt;
  }
  .mockup .frame {
    background: ${PAPER_RAISED};
    border: 1px solid ${PAPER_EDGE};
    border-radius: 8pt;
    padding: 14pt;
  }
  .mockup img {
    width: 100%;
    height: auto;
    /* Cap so the mockup rides on page 2 next to the API section,
       not overflowing to a page 3. */
    max-height: 5.2in;
    object-fit: contain;
    display: block;
    border-radius: 4pt;
  }
</style>
</head>
<body>

<!-- Page 1: narrative sections -->
<div class="page">
  <div class="tag">Google Ads API · Basic Access Application</div>
  <h1>Niewdel App</h1>
  <div class="header-meta">
    Submitter Justin Ledwein · justin@niewdel.com · Manager Customer ID 481-335-8829
  </div>

  <section>
    <div class="label">Company Name</div>
    <p>Niewdel, LLC</p>
  </section>

  <section>
    <div class="label">Business Model</div>
    <p>
      Niewdel is a software studio in Charlotte, NC. We design websites
      and build custom software for small businesses. As part of our
      managed services we send each client a monthly performance report
      that consolidates SEO health, organic traffic, and paid campaign
      results.
    </p>
    <p>
      We do not run or manage ad campaigns. Our clients' own teams (or
      their separate ad agencies) run the campaigns. Niewdel is strictly
      read-only: we pull the metrics that are already there and roll
      them into the report we deliver to the same client.
    </p>
  </section>

  <section>
    <div class="label">Tool Access &amp; Use</div>
    <p>
      The Niewdel App is an internal operator dashboard used only by
      Niewdel staff. Clients never log into it. Each month we render a
      report and send it to the client both as an email and as a
      token-protected web page. The report includes the client's own
      Google Ads performance numbers, alongside their SEO health and
      traffic data.
    </p>
  </section>

  <section>
    <div class="label">Tool Design</div>
    <p>
      Read-only and narrow. For each report the app authenticates as
      our agency MCC with a single OAuth refresh token, issues one
      <code>GoogleAdsService.search</code> call against the campaign
      resource for the linked client customer ID over the reporting
      window, aggregates the returned rows, and renders the totals. We
      do not create, modify, pause, or delete campaigns; do not change
      budgets or bids; and never write to the API. Clients link their
      existing ad account to our MCC and we read it through manager
      access, so we do not store per-client credentials.
    </p>
  </section>
</div>

<!-- Page 2: API Services Called + Tool Mockup -->
<div class="page">
  <section>
    <div class="label">API Services Called</div>
    <p>
      Only <code>GoogleAdsService.search</code> against the campaign
      resource:
    </p>
<pre class="code">SELECT
  campaign.name,
  campaign.status,
  metrics.clicks,
  metrics.impressions,
  metrics.cost_micros,
  metrics.conversions
FROM campaign
WHERE segments.date BETWEEN &lt;start&gt; AND &lt;end&gt;</pre>
  </section>

  <div class="mockup">
    <div class="label">Tool Mockup</div>
    <p class="caption">
      The Google Ads section of the monthly client report. This is
      exactly what the API data is rendered into, nothing more.
    </p>
    <div class="frame">
      <img src="data:image/png;base64,${screenshotB64}" alt="Niewdel App Google Ads mockup" />
    </div>
  </div>
</div>

</body>
</html>`;

{
  const page = await browser.newPage();
  await page.setContent(pdfHtml, { waitUntil: "networkidle" });
  await page.pdf({
    path: PDF_PATH,
    format: "Letter",
    printBackground: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
  });
}

await browser.close();

writeFileSync(
  path.join(OUT_DIR, "niewdel-google-ads-api-application.html"),
  pdfHtml,
);

console.log("PDF:        ", PDF_PATH);
console.log("Mockup PNG: ", ADS_SHOT_PATH);
