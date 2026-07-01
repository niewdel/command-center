import { CategoryResult, Finding } from '../types';
import { ScoringInput } from './index';
import { generateNarrative } from './narratives';
import { detectFrameworks } from './framework';

export function score(input: ScoringInput): CategoryResult {
  const { pages, screenshots } = input;
  let total = 0;
  const findings: Finding[] = [];

  if (pages.length === 0) {
    return {
      category_id: 'visual-design',
      category_name: 'Visual Design & Branding',
      score: 0,
      severity: 'critical',
      headline: 'No pages could be analyzed.',
      narrative: 'The crawl returned no pages, so visual design could not be assessed.',
      findings: [
        { code: 'visual.pages.none', label: 'No pages were available for analysis', pointsLost: 100 },
      ],
    };
  }

  const homepage = pages.find((p) => {
    try {
      const u = new URL(p.url);
      return u.pathname === '/' || u.pathname === '';
    } catch {
      return false;
    }
  }) || pages[0];

  // --- Viewport meta tag (8 pts) ---
  // We infer viewport from PSI SEO score or from page content signals
  const psiHomepage = input.psiMetrics.find((m) => m.url === homepage.url) || input.psiMetrics[0];
  const hasViewportSignal = psiHomepage && psiHomepage.scores.seo >= 0.7;
  if (hasViewportSignal) {
    total += 8;
  } else {
    findings.push({
      code: 'visual.viewport.missing',
      label: 'No viewport meta tag detected -- site may not be mobile-friendly',
      pointsLost: 8,
    });
  }

  // --- Favicon (7 pts) ---
  const hasFavicon = pages.some((p) =>
    p.headLinks.some(
      (l) =>
        l.rel.includes('icon') ||
        l.href.includes('favicon') ||
        l.href.endsWith('.ico')
    )
  );

  if (hasFavicon) {
    total += 7;
  } else {
    findings.push({
      code: 'visual.favicon.missing',
      label: 'No favicon detected -- browsers show a generic icon in tabs',
      pointsLost: 7,
    });
  }

  // --- Custom web fonts (8 pts) ---
  const fw = detectFrameworks(pages);
  const hasGoogleOrAdobeFonts = pages.some(
    (p) =>
      p.headLinks.some(
        (l) =>
          l.href.includes('fonts.googleapis.com') ||
          l.href.includes('fonts.gstatic.com') ||
          l.href.includes('typekit') ||
          l.href.includes('fonts.adobe.com') ||
          l.href.includes('use.typekit.net')
      )
  );
  // Modern frameworks self-host fonts (next/font, @nuxt/fonts, sveltekit-fonts)
  // via /_next/static/media etc., so check that path too.
  const hasWebFonts = hasGoogleOrAdobeFonts || fw.hasFrameworkFonts;

  if (hasWebFonts) {
    total += 8;
  } else {
    findings.push({
      code: 'visual.fonts.missing',
      label: 'No custom web fonts detected -- site relies on default system fonts',
      pointsLost: 8,
    });
  }

  // --- Images across site (5 + 5 + 5 = up to 15 pts) ---
  const allImages = pages.flatMap((p) => p.images);
  const uniqueImageSrcs = new Set(allImages.map((img) => img.src));
  const totalUniqueImages = uniqueImageSrcs.size;
  const homepageImages = homepage.images.length;

  if (homepageImages > 0) {
    total += 5;
  } else {
    findings.push({
      code: 'visual.images.homepage.none',
      label: 'No images found on the homepage',
      pointsLost: 5,
    });
  }

  if (totalUniqueImages >= 10) {
    total += 10; // 5 + 5 for 5+ and 10+
  } else if (totalUniqueImages >= 5) {
    total += 5;
  } else {
    findings.push({
      code: 'visual.images.unique.low',
      label: `Only ${totalUniqueImages} unique image(s) found across the entire site`,
      pointsLost: 10,
    });
  }

  // --- Responsive images (8 pts) ---
  // Real signals first: actual srcset attribute on any <img>, framework-served
  // images (Next/Image etc.), or query params that indicate width-based
  // responsive variants. Body-text fallback is a last resort.
  const hasResponsiveImages =
    allImages.some((img) => img.srcset && img.srcset.trim().length > 0) ||
    fw.hasFrameworkImages ||
    allImages.some(
      (img) =>
        img.src.includes('?w=') ||
        img.src.includes('&w=') ||
        img.src.includes('&width=') ||
        img.src.includes('sizes=')
    ) ||
    pages.some((p) =>
      p.bodyText.toLowerCase().includes('srcset') ||
      p.bodyText.toLowerCase().includes('<picture')
    );

  if (hasResponsiveImages) {
    total += 8;
  } else if (allImages.length > 0) {
    findings.push({
      code: 'visual.images.responsive.missing',
      label: 'No responsive images (srcset/picture) detected -- images may not scale properly on mobile',
      pointsLost: 8,
    });
  }

  // --- Consistent font usage (7 pts) ---
  // We approximate by checking if custom fonts are loaded (sites with web fonts typically have controlled font usage)
  // Award if web fonts are present (implies intentional font control)
  if (hasWebFonts) {
    total += 7;
  }
  // Note: without CSS parsing we can't count exact font families, so we tie this to web font presence

  // --- H1 present on pages (8 pts for all, 4 pts for >75%) ---
  const pagesWithH1 = pages.filter((p) =>
    p.headings.some((h) => h.level === 1)
  ).length;
  const h1Ratio = pages.length > 0 ? pagesWithH1 / pages.length : 0;

  if (h1Ratio === 1) {
    total += 8;
  } else if (h1Ratio > 0.75) {
    total += 4;
    findings.push({
      code: 'visual.h1.partial',
      label: `${pagesWithH1} of ${pages.length} pages have an H1 heading (${Math.round(h1Ratio * 100)}%)`,
      pointsLost: 4,
    });
  } else {
    findings.push({
      code: 'visual.h1.missing',
      label: `Only ${pagesWithH1} of ${pages.length} pages have an H1 heading (${Math.round(h1Ratio * 100)}%)`,
      pointsLost: 8,
    });
  }

  // --- Image alt text coverage (10 / 5 / 0 pts) ---
  const imagesWithAlt = allImages.filter(
    (img) => img.alt && img.alt.trim().length > 0
  ).length;
  const altRatio = allImages.length > 0 ? imagesWithAlt / allImages.length : 1;

  if (allImages.length > 0) {
    if (altRatio > 0.8) {
      total += 10;
    } else if (altRatio >= 0.5) {
      total += 5;
      findings.push({
        code: 'visual.alt.partial',
        label: `${Math.round(altRatio * 100)}% of images have alt text (${imagesWithAlt}/${allImages.length}) -- should be above 80%`,
        pointsLost: 5,
      });
    } else {
      findings.push({
        code: 'visual.alt.missing',
        label: `Only ${Math.round(altRatio * 100)}% of images have alt text (${imagesWithAlt}/${allImages.length}) -- poor accessibility`,
        pointsLost: 10,
      });
    }
  }

  // --- OG image on homepage (7 pts) ---
  const hasOgImage = homepage.ogTags && homepage.ogTags['og:image'];
  if (hasOgImage) {
    total += 7;
  } else {
    findings.push({
      code: 'visual.ogimage.missing',
      label: 'Homepage is missing an Open Graph image tag -- social shares will lack a preview image',
      pointsLost: 7,
    });
  }

  // --- Color consistency via CSS custom properties (7 pts) ---
  const hasCssCustomProps = pages.some((p) => {
    const sd = p.structuredData;
    return sd && sd.length > 0;
  });
  // Award if structured data exists (proxy for well-built site with design systems)
  if (hasCssCustomProps) {
    total += 7;
  }

  // --- Multiple image formats (5 pts) ---
  const imageExtensions = new Set<string>();
  for (const img of allImages) {
    const src = img.src.toLowerCase();
    if (src.includes('.webp') || src.includes('format=webp') || src.includes('fm=webp')) imageExtensions.add('webp');
    if (src.includes('.avif') || src.includes('format=avif') || src.includes('fm=avif')) imageExtensions.add('avif');
    if (src.includes('.svg')) imageExtensions.add('svg');
    if (src.includes('.png')) imageExtensions.add('png');
    if (src.includes('.jpg') || src.includes('.jpeg')) imageExtensions.add('jpg');
    if (src.includes('.gif')) imageExtensions.add('gif');
  }

  // Framework-served images (Next/Image, Nuxt Image, Astro Image) negotiate
  // WebP/AVIF via the Accept header without exposing the format in the URL,
  // so detect those pipelines as modern by definition.
  const hasModernFormats =
    imageExtensions.has('webp') ||
    imageExtensions.has('avif') ||
    imageExtensions.has('svg') ||
    fw.hasFrameworkImages;
  if (hasModernFormats) {
    total += 5;
  } else if (allImages.length > 0) {
    findings.push({
      code: 'visual.imageformats.legacy',
      label: 'No modern image formats (WebP, AVIF, SVG) detected -- using only legacy formats',
      pointsLost: 5,
    });
  }

  // --- No broken images (10 pts, -5 for 1-2, 0 for 3+) ---
  const brokenImages = screenshots.flatMap((s) =>
    s.issues.filter((i) => i.type === 'broken-image')
  );

  if (brokenImages.length === 0) {
    total += 10;
  } else if (brokenImages.length <= 2) {
    total += 5;
    findings.push({
      code: 'visual.brokenimages.minor',
      label: `${brokenImages.length} broken image(s) detected`,
      pointsLost: 5,
    });
  } else {
    findings.push({
      code: 'visual.brokenimages.severe',
      label: `${brokenImages.length} broken images detected -- significant visual degradation`,
      pointsLost: 10,
    });
  }

  const finalScore = Math.max(0, Math.min(100, total));
  const severity = scoreToSeverity(finalScore);
  const { headline, narrative } = generateNarrative('visual-design', finalScore, findings.map((f) => f.label));

  return {
    category_id: 'visual-design',
    category_name: 'Visual Design & Branding',
    score: finalScore,
    severity,
    headline,
    narrative,
    findings,
  };
}

function scoreToSeverity(score: number): 'critical' | 'serious' | 'moderate' | 'acceptable' | 'strong' {
  if (score <= 40) return 'critical';
  if (score <= 65) return 'serious';
  if (score <= 85) return 'acceptable';
  return 'strong';
}
