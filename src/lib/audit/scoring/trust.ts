import { CategoryResult, Finding } from '../types';
import { ScoringInput } from './index';
import { generateNarrative } from './narratives';

const SOCIAL_PLATFORMS = [
  { name: 'Facebook', pattern: /facebook\.com/i },
  { name: 'Instagram', pattern: /instagram\.com/i },
  { name: 'LinkedIn', pattern: /linkedin\.com/i },
  { name: 'Twitter/X', pattern: /(?:twitter\.com|x\.com)/i },
  { name: 'YouTube', pattern: /youtube\.com/i },
];

const TESTIMONIAL_KEYWORDS = [
  'testimonial', 'review', 'what our clients', 'what our customers',
  'stars', 'rating',
];

const ADDRESS_PATTERNS = [
  /\d{1,5}\s+[\w\s]+(?:street|st|avenue|ave|road|rd|boulevard|blvd|drive|dr|lane|ln|way|court|ct|place|pl|circle|cir)\b/i,
  /\b[A-Z]{2}\s+\d{5}(?:-\d{4})?\b/,
  /\bsuite\s+\d+/i,
  /\bP\.?O\.?\s*Box\s+\d+/i,
];

const CERT_KEYWORDS = [
  'certified', 'licensed', 'insured', 'award', 'accredited',
];

const TRUST_BADGE_KEYWORDS = [
  'bbb', 'better business', 'chamber of commerce',
];

export function score(input: ScoringInput): CategoryResult {
  const { pages, rootUrl } = input;
  let total = 0;
  const findings: Finding[] = [];

  if (pages.length === 0) {
    return {
      category_id: 'trust',
      category_name: 'Trust & Credibility',
      score: 0,
      severity: 'critical',
      headline: 'No pages could be analyzed.',
      narrative: 'The crawl returned no pages, so trust signals could not be assessed.',
      findings: [
        { code: 'trust.pages.none', label: 'No pages were available for analysis', pointsLost: 100 },
      ],
    };
  }

  // --- HTTPS/SSL (15 pts) ---
  const isHttps = rootUrl.startsWith('https://') || rootUrl.startsWith('https:');
  if (isHttps) {
    total += 15;
  } else {
    findings.push({
      code: 'trust.https.missing',
      label: 'Site is NOT using HTTPS -- critical trust and security issue that browsers flag as "Not Secure"',
      pointsLost: 15,
    });
  }

  // --- Privacy policy (8 pts) ---
  const hasPrivacyPolicy = pages.some((p) => {
    const url = p.url.toLowerCase();
    return url.includes('privacy') || url.includes('privacypolicy');
  }) || pages.some((p) =>
    p.links.some((l) => {
      const href = l.href.toLowerCase();
      const text = l.text.toLowerCase();
      return (
        href.includes('privacy') ||
        text.includes('privacy policy') ||
        text.includes('privacy')
      );
    })
  );

  if (hasPrivacyPolicy) {
    total += 8;
  } else {
    findings.push({
      code: 'trust.privacypolicy.missing',
      label: 'No privacy policy page detected -- may violate data protection regulations',
      pointsLost: 8,
    });
  }

  // --- Terms of service (5 pts) ---
  const hasTerms = pages.some((p) => {
    const url = p.url.toLowerCase();
    return url.includes('terms') || url.includes('tos');
  }) || pages.some((p) =>
    p.links.some((l) => {
      const href = l.href.toLowerCase();
      const text = l.text.toLowerCase();
      return (
        href.includes('terms') ||
        text.includes('terms of service') ||
        text.includes('terms and conditions') ||
        text.includes('terms of use')
      );
    })
  );

  if (hasTerms) {
    total += 5;
  } else {
    findings.push({ code: 'trust.terms.missing', label: 'No terms of service page detected', pointsLost: 5 });
  }

  // --- Contact page (8 pts) ---
  const hasContactPage = pages.some((p) => {
    const url = p.url.toLowerCase();
    return url.includes('contact');
  }) || pages.some((p) =>
    p.links.some((l) => {
      const href = l.href.toLowerCase();
      const text = l.text.toLowerCase();
      return href.includes('contact') || text.includes('contact');
    })
  );

  if (hasContactPage) {
    total += 8;
  } else {
    findings.push({ code: 'trust.contactpage.missing', label: 'No dedicated contact page detected', pointsLost: 8 });
  }

  // --- Physical address (10 pts) ---
  const allBodyText = pages.map((p) => p.bodyText).join(' ');
  const hasAddress = ADDRESS_PATTERNS.some((pattern) => pattern.test(allBodyText));

  if (hasAddress) {
    total += 10;
  } else {
    findings.push({
      code: 'trust.address.missing',
      label: 'No physical address found on the site -- reduces credibility for local businesses',
      pointsLost: 10,
    });
  }

  // --- Social media links (2 pts each, max 10 pts) ---
  const allLinks = pages.flatMap((p) => p.links);
  const foundPlatforms: string[] = [];
  const missingPlatforms: string[] = [];

  const allIframeSrcs = pages.flatMap((p) => p.iframes.map((iframe) => iframe.src));
  for (const platform of SOCIAL_PLATFORMS) {
    const found = allLinks.some((l) => platform.pattern.test(l.href)) ||
      allIframeSrcs.some((src) => platform.pattern.test(src));
    if (found) {
      foundPlatforms.push(platform.name);
    } else {
      missingPlatforms.push(platform.name);
    }
  }

  const socialPoints = Math.min(10, foundPlatforms.length * 2);
  total += socialPoints;

  if (foundPlatforms.length === 0) {
    findings.push({
      code: 'trust.social.none',
      label: 'No social media links found anywhere on the site',
      pointsLost: 10,
    });
  } else if (foundPlatforms.length < 3) {
    findings.push({
      code: 'trust.social.partial',
      label: `Only ${foundPlatforms.length} social media platform(s) linked: ${foundPlatforms.join(', ')}`,
      pointsLost: 10 - socialPoints,
    });
  }

  // --- Testimonials/reviews (12 pts) ---
  const hasReviewWidget = pages.some((p) =>
    p.iframes.some((iframe) => {
      const src = iframe.src.toLowerCase();
      const title = iframe.title.toLowerCase();
      return (
        src.includes('google.com/maps') ||
        title.includes('review') ||
        src.includes('elfsight') ||
        src.includes('reviewsonmywebsite') ||
        src.includes('trustpilot')
      );
    })
  );
  const hasTestimonials = hasReviewWidget || pages.some((p) => {
    const body = p.bodyText.toLowerCase();
    return TESTIMONIAL_KEYWORDS.some((kw) => body.includes(kw));
  });

  if (hasTestimonials) {
    total += 12;
  } else {
    findings.push({
      code: 'trust.testimonials.missing',
      label: 'No testimonials or reviews section detected -- missing critical social proof',
      pointsLost: 12,
    });
  }

  // --- Business schema markup (10 pts) ---
  const hasBusinessSchema = pages.some((p) =>
    p.structuredData.some((sd) => {
      const json = JSON.stringify(sd).toLowerCase();
      return (
        json.includes('localbusiness') ||
        json.includes('organization') ||
        json.includes('localservice') ||
        json.includes('professionalservice')
      );
    })
  );

  if (hasBusinessSchema) {
    total += 10;
  } else {
    findings.push({
      code: 'trust.schema.missing',
      label: 'No business schema markup (LocalBusiness/Organization) found -- missing Google Knowledge Panel opportunity',
      pointsLost: 10,
    });
  }

  // --- About page (7 pts) ---
  const hasAboutPage = pages.some((p) => {
    try {
      return new URL(p.url).pathname.toLowerCase().includes('about');
    } catch {
      return false;
    }
  }) || pages.some((p) =>
    p.links.some((l) => {
      const href = l.href.toLowerCase();
      const text = l.text.toLowerCase();
      return href.includes('about') || text === 'about' || text === 'about us';
    })
  );

  if (hasAboutPage) {
    total += 7;
  } else {
    findings.push({
      code: 'trust.aboutpage.missing',
      label: 'No About page detected -- visitors cannot learn about the people behind the business',
      pointsLost: 7,
    });
  }

  // --- Google Business Profile link or embedded map (5 pts) ---
  const hasGBPLink = allLinks.some(
    (l) =>
      l.href.includes('google.com/maps') ||
      l.href.includes('g.co/') ||
      l.href.includes('goo.gl/') ||
      l.href.includes('maps.google')
  );
  const hasGBPEmbed = pages.some((p) =>
    p.iframes.some((iframe) => {
      const src = iframe.src.toLowerCase();
      return src.includes('google.com/maps') || src.includes('maps.google');
    })
  );
  const hasGBP = hasGBPLink || hasGBPEmbed;

  if (hasGBP) {
    total += 5;
  }

  // --- Industry certifications/awards (5 pts) ---
  const bodyTextLower = allBodyText.toLowerCase();
  const hasCerts = CERT_KEYWORDS.some((kw) => bodyTextLower.includes(kw));

  if (hasCerts) {
    total += 5;
  }

  // --- BBB or trust badges (5 pts) ---
  const hasTrustBadges = TRUST_BADGE_KEYWORDS.some((kw) => bodyTextLower.includes(kw)) ||
    allLinks.some((l) => l.href.toLowerCase().includes('bbb.org'));

  if (hasTrustBadges) {
    total += 5;
  }

  const finalScore = Math.max(0, Math.min(100, total));
  const severity = scoreToSeverity(finalScore);
  const { headline, narrative } = generateNarrative('trust', finalScore, findings.map((f) => f.label));

  return {
    category_id: 'trust',
    category_name: 'Trust & Credibility',
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
