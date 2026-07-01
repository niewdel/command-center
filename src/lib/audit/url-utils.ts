// ---------------------------------------------------------------------------
// Shared URL helpers used by both the crawler (crawl.ts) and pure
// URL-shaping logic (discover-main-pages.ts). Kept in their own module so
// the two don't need to import from each other.
// ---------------------------------------------------------------------------

export const SKIP_EXTENSIONS = new Set([
  '.pdf', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico',
  '.mp4', '.mp3', '.wav', '.avi', '.mov', '.zip', '.tar', '.gz',
  '.css', '.js', '.woff', '.woff2', '.ttf', '.eot', '.xml',
]);

export function normalizeUrl(raw: string, base?: string): string | null {
  try {
    const url = new URL(raw, base);
    // Only crawl http(s)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    // Strip fragment
    url.hash = '';
    // Strip common tracking query params but keep meaningful ones
    // For dedup we strip ALL query params — most small-biz sites don't rely on them
    url.search = '';
    // Remove trailing slash (except for root)
    const path = url.pathname.replace(/\/+$/, '') || '/';
    url.pathname = path;
    return url.toString();
  } catch {
    return null;
  }
}

export function isSameDomain(urlStr: string, rootOrigin: string): boolean {
  try {
    return new URL(urlStr).origin === rootOrigin;
  } catch {
    return false;
  }
}

export function hasSkippableExtension(urlStr: string): boolean {
  try {
    const pathname = new URL(urlStr).pathname.toLowerCase();
    return Array.from(SKIP_EXTENSIONS).some((ext) => pathname.endsWith(ext));
  } catch {
    return false;
  }
}
