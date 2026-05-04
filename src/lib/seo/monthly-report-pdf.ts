// Renders a monthly SEO report HTML string to PDF bytes via Playwright's
// chromium print-to-PDF. Reuses the same chromium binary the audit crawler
// already installs on Railway via railpack.json.

import { chromium, type LaunchOptions } from "playwright";

function getLaunchOptions(): LaunchOptions {
  // Match audit/crawl launch options — Railway sets PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH.
  const exec = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  return exec ? { executablePath: exec } : {};
}

export async function renderMonthlyReportPdf(html: string): Promise<Buffer> {
  const browser = await chromium.launch(getLaunchOptions());
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.setContent(html, { waitUntil: "load", timeout: 30_000 });
    const pdf = await page.pdf({
      format: "letter",
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });
    return pdf;
  } finally {
    await browser.close();
  }
}
