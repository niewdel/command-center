// src/lib/seo/monthly-report-pdf.ts
//
// Navigates Playwright to a URL (the print-mode report route) and prints
// the page to PDF bytes. Replaces the prior "render this HTML string"
// approach now that the report is a real Next.js route.

import { chromium, type LaunchOptions } from "playwright";

function getLaunchOptions(): LaunchOptions {
  const exec = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  return exec ? { executablePath: exec } : {};
}

interface RenderOptions {
  /** HTML snippet rendered at the bottom of every printed page. */
  footerTemplate?: string;
}

export async function renderMonthlyReportPdf(
  url: string,
  opts: RenderOptions = {}
): Promise<Buffer> {
  const browser = await chromium.launch(getLaunchOptions());
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(url, { waitUntil: "networkidle", timeout: 60_000 });

    const pdfArgs: Parameters<typeof page.pdf>[0] = {
      format: "letter",
      printBackground: true,
      margin: { top: "14mm", right: "0", bottom: "16mm", left: "0" },
    };

    if (opts.footerTemplate) {
      pdfArgs.displayHeaderFooter = true;
      pdfArgs.headerTemplate = "<span></span>";
      pdfArgs.footerTemplate = opts.footerTemplate;
    }

    return await page.pdf(pdfArgs);
  } finally {
    await browser.close();
  }
}
