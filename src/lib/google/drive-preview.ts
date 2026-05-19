/**
 * Google Drive share-link helpers. Works for files set to "Anyone with the
 * link" (which is what share-link pastes always are) — no OAuth required.
 *
 * Patterns we recognize:
 *   https://drive.google.com/file/d/<ID>/view?usp=sharing
 *   https://drive.google.com/file/d/<ID>/edit
 *   https://drive.google.com/open?id=<ID>
 *   https://docs.google.com/document/d/<ID>/edit
 *   https://docs.google.com/spreadsheets/d/<ID>/edit
 *   https://docs.google.com/presentation/d/<ID>/edit
 */

export function extractDriveFileId(url: string): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (!/(drive|docs)\.google\.com$/.test(u.hostname)) return null;

    // /file/d/<ID>/...
    // /document/d/<ID>/...
    // /spreadsheets/d/<ID>/...
    // /presentation/d/<ID>/...
    const m = u.pathname.match(/\/(?:file|document|spreadsheets|presentation)\/d\/([^/]+)/);
    if (m) return m[1];

    // /open?id=<ID>
    const idParam = u.searchParams.get("id");
    if (idParam) return idParam;

    return null;
  } catch {
    return null;
  }
}

export function getDriveThumbnailUrl(fileId: string, size = 400): string {
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w${size}`;
}

export function getDriveViewerUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/view`;
}

/**
 * Server-only: scrape the filename from the public Drive preview page.
 * The page is public for share-link files; the <title> looks like:
 *   "Proposal — Atlas Construction.pdf - Google Drive"
 * If anything fails, returns null and the caller should fall back to the URL.
 */
export async function fetchDriveFilename(fileId: string): Promise<string | null> {
  try {
    const res = await fetch(`https://drive.google.com/file/d/${fileId}/view`, {
      headers: {
        // A real-browser UA tends to get the rich HTML instead of a stripped
        // mobile/no-JS version.
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
      },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    const m = html.match(/<title>([^<]+)<\/title>/i);
    if (!m) return null;
    // Strip the trailing " - Google Drive" / " - Google Docs" suffix.
    return m[1].replace(/\s+-\s+Google\s+(Drive|Docs|Sheets|Slides)\s*$/i, "").trim();
  } catch {
    return null;
  }
}
