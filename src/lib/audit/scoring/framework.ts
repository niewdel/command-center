import type { CrawledPage } from '../types';

// Detects modern frontend frameworks so the scorer doesn't false-flag
// patterns that are perfectly fine on Next.js, Nuxt, SvelteKit, etc. but
// don't match the legacy heuristics (Google Fonts URL, .webp extension, etc.)

export interface FrameworkSignals {
  isNextJs: boolean;
  isNuxt: boolean;
  isSvelteKit: boolean;
  isAstro: boolean;
  /** True if the site self-hosts fonts via a modern framework's font pipeline. */
  hasFrameworkFonts: boolean;
  /** True if any image is served through a framework image-optimization pipeline. */
  hasFrameworkImages: boolean;
}

function pageMatches(p: CrawledPage, predicate: (s: string) => boolean): boolean {
  if (p.headLinks.some((l) => predicate(l.href))) return true;
  if (p.images.some((i) => predicate(i.src) || (i.srcset ? predicate(i.srcset) : false))) return true;
  if (p.links.some((l) => predicate(l.href))) return true;
  return false;
}

export function detectFrameworks(pages: CrawledPage[]): FrameworkSignals {
  const isNextJs = pages.some((p) => pageMatches(p, (s) => s.includes('/_next/')));
  const isNuxt = pages.some((p) => pageMatches(p, (s) => s.includes('/_nuxt/')));
  const isSvelteKit = pages.some((p) => pageMatches(p, (s) => s.includes('/_app/immutable/')));
  const isAstro = pages.some((p) => pageMatches(p, (s) => s.includes('/_astro/')));

  // Framework-served fonts: Next.js next/font puts woff2 under /_next/static/media/
  const hasFrameworkFonts = pages.some((p) =>
    p.headLinks.some(
      (l) =>
        /\/_next\/static\/media\/.+\.(woff2?|ttf|otf)/.test(l.href) ||
        /\/_nuxt\/.+\.(woff2?|ttf|otf)/.test(l.href) ||
        /\/_app\/immutable\/.+\.(woff2?|ttf|otf)/.test(l.href)
    )
  );

  // Framework-optimized images: Next.js Image, Nuxt Image, etc.
  const hasFrameworkImages = pages.some((p) =>
    p.images.some(
      (i) =>
        i.src.includes('/_next/image') ||
        i.src.includes('/_ipx/') || // Nuxt image
        i.src.includes('/_image?')  // Astro image service
    )
  );

  return {
    isNextJs,
    isNuxt,
    isSvelteKit,
    isAstro,
    hasFrameworkFonts,
    hasFrameworkImages,
  };
}
