// Renders a monthly SEO report HTML string to PDF bytes via Playwright's
// chromium print-to-PDF. Reuses the same chromium binary the audit crawler
// already installs on Railway via railpack.json.
//
// Footer: rendered on EVERY page via Playwright's footerTemplate option.
// We reserve ~16mm of bottom margin so the footer has room to sit; the
// remaining 3 sides stay edge-to-edge so the body content fills the page.

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
  html: string,
  opts: RenderOptions = {}
): Promise<Buffer> {
  const browser = await chromium.launch(getLaunchOptions());
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.setContent(html, { waitUntil: "load", timeout: 30_000 });

    const pdfArgs: Parameters<typeof page.pdf>[0] = {
      format: "letter",
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "16mm", left: "0" },
    };

    if (opts.footerTemplate) {
      pdfArgs.displayHeaderFooter = true;
      // headerTemplate is required when displayHeaderFooter=true even if we
      // only want a footer — empty span suppresses the default date/title.
      pdfArgs.headerTemplate = "<span></span>";
      pdfArgs.footerTemplate = opts.footerTemplate;
    }

    return await page.pdf(pdfArgs);
  } finally {
    await browser.close();
  }
}
