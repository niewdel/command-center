import { CategoryResult, Finding } from '../types';
import { ScoringInput } from './index';
import { generateNarrative } from './narratives';

const CTA_WORDS = [
  'contact', 'call', 'get started', 'schedule', 'buy', 'order', 'sign up',
  'learn more', 'get quote', 'free', 'book', 'request', 'subscribe',
  'download', 'register', 'start', 'try', 'demo', 'consultation',
  'estimate', 'appointment', 'reserve', 'enroll', 'join',
];

const TESTIMONIAL_KEYWORDS = [
  'testimonial', 'review', 'what our', 'what clients', 'what customers',
  'stars', 'rating', 'feedback', 'client says', 'customer says',
  'hear from', 'success stories',
];

const LEAD_MAGNET_KEYWORDS = [
  'free', 'download', 'guide', 'ebook', 'e-book', 'discount',
  'offer', 'special', 'whitepaper', 'checklist', 'template',
];

const PRICING_KEYWORDS = [
  'pricing', 'price', 'quote', 'estimate', 'cost',
];

const FORM_SERVICE_PATTERNS = [
  /hsforms\.net/i, /hubspot/i, /typeform\.com/i, /calendly\.com/i,
  /jotform\.com/i, /docs\.google\.com\/forms/i, /wufoo\.com/i,
  /formstack/i, /gravityforms/i, /cognitoforms/i,
];

const PHONE_REGEX = /(\+?1?\s?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/;
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

export function score(input: ScoringInput): CategoryResult {
  const { pages } = input;
  let total = 0;
  const findings: Finding[] = [];

  if (pages.length === 0) {
    return {
      category_id: 'conversion',
      category_name: 'Conversion Architecture',
      score: 0,
      severity: 'critical',
      headline: 'No pages could be analyzed.',
      narrative: 'The crawl returned no pages, so conversion architecture could not be assessed.',
      findings: [
        { code: 'conversion.pages.none', label: 'No pages were available for analysis', pointsLost: 100 },
      ],
    };
  }

  const homepage = pages.find((p) => {
    try {
      return new URL(p.url).pathname === '/' || new URL(p.url).pathname === '';
    } catch {
      return false;
    }
  }) || pages[0];

  // --- Has at least one form (15 pts) ---
  const hasNativeForm = pages.some((p) => p.forms.length > 0);
  const hasIframeForm = pages.some((p) =>
    p.iframes.some((iframe) => {
      const src = iframe.src.toLowerCase();
      const title = iframe.title.toLowerCase();
      return (
        FORM_SERVICE_PATTERNS.some((pat) => pat.test(src)) ||
        title.includes('form')
      );
    })
  );
  const hasForm = hasNativeForm || hasIframeForm;

  const hasFormPage = pages.some((p) =>
    p.links.some((l) => {
      const href = l.href.toLowerCase();
      return (
        href.includes('contact') ||
        href.includes('form') ||
        href.includes('quote') ||
        href.includes('inquiry')
      );
    })
  );

  if (hasForm || hasFormPage) {
    total += 15;
  } else {
    findings.push({
      code: 'conversion.forms.none',
      label: 'No forms detected on any page -- no way for visitors to submit information',
      pointsLost: 15,
    });
  }

  // --- Form simplicity: 5 or fewer fields (10 pts), 6-8 (5 pts), >8 (0 pts) ---
  if (hasNativeForm) {
    // Use actual field count from the first native form found
    const pageWithForm = pages.find((p) => p.forms.length > 0)!;
    const detectedFields = pageWithForm.forms[0].fieldCount;

    if (detectedFields <= 5) {
      total += 10;
    } else if (detectedFields <= 8) {
      total += 5;
      findings.push({
        code: 'conversion.form.fields.moderate',
        label: `Forms have ${detectedFields} fields -- consider simplifying to reduce friction`,
        pointsLost: 5,
      });
    } else {
      findings.push({
        code: 'conversion.form.fields.excessive',
        label: `Forms have ${detectedFields}+ fields -- high friction reduces submissions significantly`,
        pointsLost: 10,
      });
    }
  } else if (hasIframeForm) {
    // Can't inspect iframe form fields; give benefit of the doubt
    total += 10;
  }

  // --- Multiple conversion paths (15 / 8 / 3 pts) ---
  const hasPhone = pages.some((p) => PHONE_REGEX.test(p.bodyText));
  const hasEmail = pages.some((p) => EMAIL_REGEX.test(p.bodyText));
  const conversionPaths = [hasForm || hasFormPage, hasPhone, hasEmail].filter(Boolean).length;

  if (conversionPaths === 3) {
    total += 15;
  } else if (conversionPaths === 2) {
    total += 8;
    const missing: string[] = [];
    if (!hasForm && !hasFormPage) missing.push('contact form');
    if (!hasPhone) missing.push('phone number');
    if (!hasEmail) missing.push('email address');
    findings.push({
      code: 'conversion.paths.partial',
      label: `Missing conversion path: ${missing.join(', ')}`,
      pointsLost: 7,
    });
  } else if (conversionPaths === 1) {
    total += 3;
    findings.push({
      code: 'conversion.paths.single',
      label: 'Only one type of contact method available -- visitors need options',
      pointsLost: 12,
    });
  } else {
    findings.push({
      code: 'conversion.paths.none',
      label: 'No contact methods (form, phone, or email) detected anywhere on the site',
      pointsLost: 15,
    });
  }

  // --- Social proof near CTAs (12 / 5 pts) ---
  const pagesWithCTA = pages.filter((p) => {
    const body = p.bodyText.toLowerCase();
    const linkTexts = p.links.map((l) => l.text.toLowerCase());
    return CTA_WORDS.some(
      (w) => body.includes(w) || linkTexts.some((lt) => lt.includes(w))
    );
  });

  const pagesWithTestimonials = pages.filter((p) => {
    const body = p.bodyText.toLowerCase();
    return TESTIMONIAL_KEYWORDS.some((kw) => body.includes(kw));
  });

  const pagesWithBoth = pagesWithCTA.filter((ctaPage) =>
    pagesWithTestimonials.some((tPage) => tPage.url === ctaPage.url)
  );

  if (pagesWithBoth.length > 0) {
    total += 12;
  } else if (pagesWithTestimonials.length > 0) {
    total += 5;
    findings.push({
      code: 'conversion.socialproof.notcolocated',
      label: 'Social proof exists but not on the same pages as CTAs -- should be combined for maximum impact',
      pointsLost: 7,
    });
  } else {
    findings.push({
      code: 'conversion.socialproof.missing',
      label: 'No social proof (testimonials/reviews) found near calls to action',
      pointsLost: 12,
    });
  }

  // --- Homepage value proposition in H1 (10 / 3 pts) ---
  const homepageH1 = homepage.headings.find((h) => h.level === 1);
  if (homepageH1) {
    const h1Words = homepageH1.text.trim().split(/\s+/).length;
    if (h1Words > 5) {
      total += 10;
    } else {
      total += 3;
      findings.push({
        code: 'conversion.h1.tooshort',
        label: `Homepage H1 is only ${h1Words} words ("${homepageH1.text.trim()}") -- too short to communicate a value proposition`,
        pointsLost: 7,
      });
    }
  } else {
    findings.push({
      code: 'conversion.h1.missing',
      label: 'Homepage is missing an H1 heading -- no clear value proposition visible',
      pointsLost: 10,
    });
  }

  // --- Homepage has CTA + supporting text + H1 all present (10 / 5 / 0 pts) ---
  const hasHomepageH1 = homepage.headings.some((h) => h.level === 1);
  const hasHomepageText = homepage.bodyText.trim().split(/\s+/).length > 50;
  const hasHomepageCTA = CTA_WORDS.some(
    (w) =>
      homepage.bodyText.toLowerCase().includes(w) ||
      homepage.links.some((l) => l.text.toLowerCase().includes(w)) ||
      homepage.buttons.some((b) => b.text.toLowerCase().includes(w))
  );

  const aboveFoldElements = [hasHomepageH1, hasHomepageText, hasHomepageCTA].filter(Boolean).length;
  if (aboveFoldElements === 3) {
    total += 10;
  } else if (aboveFoldElements === 2) {
    total += 5;
    const missingElements: string[] = [];
    if (!hasHomepageH1) missingElements.push('H1 heading');
    if (!hasHomepageText) missingElements.push('supporting text');
    if (!hasHomepageCTA) missingElements.push('call to action');
    findings.push({
      code: 'conversion.abovefold.partial',
      label: `Homepage is missing: ${missingElements.join(', ')}`,
      pointsLost: 5,
    });
  } else {
    const missingElements: string[] = [];
    if (!hasHomepageH1) missingElements.push('H1 heading');
    if (!hasHomepageText) missingElements.push('supporting text');
    if (!hasHomepageCTA) missingElements.push('call to action');
    findings.push({
      code: 'conversion.abovefold.missing',
      label: `Homepage is missing key conversion elements: ${missingElements.join(', ')}`,
      pointsLost: 10,
    });
  }

  // --- Thank-you/confirmation page (8 pts) ---
  const hasThankYouPage = pages.some((p) => {
    try {
      return new URL(p.url).pathname.toLowerCase().includes('thank');
    } catch {
      return false;
    }
  }) || pages.some((p) =>
    p.links.some((l) => l.href.toLowerCase().includes('thank'))
  );

  if (hasThankYouPage) {
    total += 8;
  }

  // --- Lead magnet or special offer (8 pts) ---
  const hasLeadMagnet = pages.some((p) => {
    const body = p.bodyText.toLowerCase();
    const headingText = p.headings.map((h) => h.text.toLowerCase()).join(' ');
    const combined = body + ' ' + headingText;
    return LEAD_MAGNET_KEYWORDS.some((kw) => combined.includes(kw));
  });

  if (hasLeadMagnet) {
    total += 8;
  } else {
    findings.push({
      code: 'conversion.leadmagnet.missing',
      label: 'No lead magnet, special offer, or downloadable resource detected',
      pointsLost: 8,
    });
  }

  // --- Pricing or quote path (7 pts) ---
  const hasPricingPath = pages.some((p) => {
    const body = p.bodyText.toLowerCase();
    const linkTexts = p.links.map((l) => l.text.toLowerCase()).join(' ');
    const headingText = p.headings.map((h) => h.text.toLowerCase()).join(' ');
    const combined = linkTexts + ' ' + headingText;
    return PRICING_KEYWORDS.some((kw) => combined.includes(kw));
  }) || pages.some((p) => {
    try {
      const pathname = new URL(p.url).pathname.toLowerCase();
      return PRICING_KEYWORDS.some((kw) => pathname.includes(kw));
    } catch {
      return false;
    }
  });

  if (hasPricingPath) {
    total += 7;
  } else {
    findings.push({
      code: 'conversion.pricing.missing',
      label: 'No pricing page or "get a quote" path detected -- visitors may leave to find pricing elsewhere',
      pointsLost: 7,
    });
  }

  // --- Clear service/product pages: site has >3 pages (5 pts) ---
  if (pages.length > 3) {
    total += 5;
  } else {
    findings.push({
      code: 'conversion.depth.limited',
      label: `Site has only ${pages.length} page(s) -- not enough depth to guide different visitor types`,
      pointsLost: 5,
    });
  }

  const finalScore = Math.max(0, Math.min(100, total));
  const severity = scoreToSeverity(finalScore);
  const { headline, narrative } = generateNarrative('conversion', finalScore);

  return {
    category_id: 'conversion',
    category_name: 'Conversion Architecture',
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
