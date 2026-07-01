import { CategoryResult, Finding } from '../types';
import { ScoringInput } from './index';
import { generateNarrative } from './narratives';

const CTA_KEYWORDS = [
  'contact', 'call', 'get started', 'schedule', 'free quote', 'book',
  'request', 'buy', 'order', 'sign up', 'learn more', 'get quote',
];

const STRONG_VERBS = [
  'get', 'start', 'book', 'schedule', 'request', 'claim', 'unlock',
  'discover', 'explore', 'transform', 'join', 'reserve', 'download',
  'grab', 'secure', 'try', 'build', 'launch', 'grow',
];

const CHAT_SIGNALS = [
  'livechat', 'tawk', 'drift', 'intercom', 'crisp', 'chatbot',
  'live chat', 'chat with', 'chat now', 'hubspot',
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
      category_id: 'cta',
      category_name: 'Calls to Action',
      score: 0,
      severity: 'critical',
      headline: 'No pages could be analyzed.',
      narrative: 'The crawl returned no pages, so calls to action could not be assessed.',
      findings: [
        { code: 'cta.pages.none', label: 'No pages were available for analysis', pointsLost: 100 },
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

  // Helper: check if a page has CTA elements
  function pageHasCTA(page: typeof pages[0]): boolean {
    const linkTexts = page.links.map((l) => l.text.toLowerCase());
    const buttonTexts = page.buttons.map((b) => b.text.toLowerCase());
    const bodyLower = page.bodyText.toLowerCase();
    return CTA_KEYWORDS.some(
      (word) =>
        linkTexts.some((lt) => lt.includes(word)) ||
        buttonTexts.some((bt) => bt.includes(word)) ||
        bodyLower.includes(word)
    );
  }

  // --- Homepage has CTA-like element (10 pts) ---
  const homepageHasCTA = pageHasCTA(homepage);
  if (homepageHasCTA) {
    total += 10;
  } else {
    findings.push({ code: 'cta.homepage.missing', label: 'Homepage has no clear call-to-action element', pointsLost: 10 });
  }

  // --- CTA keywords present (2 pts per unique keyword, max 12 pts) ---
  const allBodyText = pages.map((p) => p.bodyText.toLowerCase()).join(' ');
  const allLinkTexts = pages.flatMap((p) => p.links.map((l) => l.text.toLowerCase())).join(' ');
  const combinedText = allBodyText + ' ' + allLinkTexts;

  const foundKeywords = CTA_KEYWORDS.filter((kw) => combinedText.includes(kw));
  const keywordPoints = Math.min(12, foundKeywords.length * 2);
  total += keywordPoints;

  if (foundKeywords.length === 0) {
    findings.push({
      code: 'cta.keywords.none',
      label: 'No CTA keywords found anywhere on the site (contact, call, get started, schedule, etc.)',
      pointsLost: 12,
    });
  } else if (foundKeywords.length <= 2) {
    findings.push({
      code: 'cta.keywords.few',
      label: `Only ${foundKeywords.length} CTA keyword(s) found: ${foundKeywords.join(', ')}`,
      pointsLost: 12 - keywordPoints,
    });
  }

  // --- Contact form on any page (15 pts) ---
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
    p.links.some(
      (l) =>
        l.href.toLowerCase().includes('contact') ||
        l.href.toLowerCase().includes('form') ||
        l.href.toLowerCase().includes('quote') ||
        l.href.toLowerCase().includes('inquiry')
    )
  );

  if (hasForm) {
    total += 15;
  } else if (hasFormPage) {
    total += 15;
    findings.push({
      code: 'cta.form.pagelinked',
      label: 'Contact/form page linked but form content not directly detected',
      pointsLost: 0,
    });
  } else {
    findings.push({ code: 'cta.form.missing', label: 'No contact form detected on any page', pointsLost: 15 });
  }

  // --- Phone number (10 pts homepage, 5 pts any page) ---
  const hasPhoneHomepage = PHONE_REGEX.test(homepage.bodyText);
  const hasPhoneAny = pages.some((p) => PHONE_REGEX.test(p.bodyText));

  if (hasPhoneHomepage) {
    total += 10;
  } else if (hasPhoneAny) {
    total += 5;
    findings.push({ code: 'cta.phone.nothomepage', label: 'Phone number found but not on the homepage', pointsLost: 5 });
  } else {
    findings.push({ code: 'cta.phone.missing', label: 'No phone number found on any page', pointsLost: 10 });
  }

  // --- Email address (8 pts homepage, 4 pts any page) ---
  const hasEmailHomepage = EMAIL_REGEX.test(homepage.bodyText);
  const hasEmailAny = pages.some((p) => EMAIL_REGEX.test(p.bodyText));

  if (hasEmailHomepage) {
    total += 8;
  } else if (hasEmailAny) {
    total += 4;
    findings.push({ code: 'cta.email.nothomepage', label: 'Email address found but not on the homepage', pointsLost: 4 });
  } else {
    findings.push({ code: 'cta.email.missing', label: 'No email address found on any page', pointsLost: 8 });
  }

  // --- Multiple conversion paths (15 / 8 / 3 pts) ---
  const pathCount = [hasForm || hasFormPage, hasPhoneAny, hasEmailAny].filter(Boolean).length;

  if (pathCount === 3) {
    total += 15;
  } else if (pathCount === 2) {
    total += 8;
    const missing: string[] = [];
    if (!hasForm && !hasFormPage) missing.push('contact form');
    if (!hasPhoneAny) missing.push('phone number');
    if (!hasEmailAny) missing.push('email address');
    findings.push({
      code: 'cta.paths.partial',
      label: `Missing conversion path: ${missing.join(', ')}`,
      pointsLost: 7,
    });
  } else if (pathCount === 1) {
    total += 3;
    findings.push({
      code: 'cta.paths.single',
      label: 'Only one type of contact method available -- visitors need options',
      pointsLost: 12,
    });
  } else {
    findings.push({
      code: 'cta.paths.none',
      label: 'No contact methods (form, phone, or email) detected anywhere',
      pointsLost: 15,
    });
  }

  // --- CTAs on multiple pages (10 / 5 pts) ---
  const pagesWithCTA = pages.filter(pageHasCTA);
  const ctaRatio = pages.length > 0 ? pagesWithCTA.length / pages.length : 0;

  if (ctaRatio > 0.5) {
    total += 10;
  } else if (ctaRatio > 0.25) {
    total += 5;
    findings.push({
      code: 'cta.coverage.partial',
      label: `CTAs found on only ${pagesWithCTA.length} of ${pages.length} pages (${Math.round(ctaRatio * 100)}%)`,
      pointsLost: 5,
    });
  } else {
    findings.push({
      code: 'cta.coverage.missing',
      label: `CTAs found on only ${pagesWithCTA.length} of ${pages.length} pages -- most pages are dead ends`,
      pointsLost: 10,
    });
  }

  // --- Dedicated contact page (8 pts) ---
  const hasContactPage = pages.some((p) => {
    try {
      return new URL(p.url).pathname.toLowerCase().includes('contact');
    } catch {
      return false;
    }
  }) || pages.some((p) =>
    p.links.some((l) => {
      const href = l.href.toLowerCase();
      const text = l.text.toLowerCase();
      return href.includes('contact') || text === 'contact' || text === 'contact us';
    })
  );

  if (hasContactPage) {
    total += 8;
  } else {
    findings.push({ code: 'cta.contactpage.missing', label: 'No dedicated contact page detected', pointsLost: 8 });
  }

  // --- Action-oriented CTA language (5 pts) ---
  const hasStrongVerbs = pages.some((p) => {
    const linkTexts = p.links.map((l) => l.text.toLowerCase());
    const buttonTexts = p.buttons.map((b) => b.text.toLowerCase());
    const allTexts = [...linkTexts, ...buttonTexts];
    return allTexts.some((lt) =>
      STRONG_VERBS.some((v) => lt.startsWith(v) || lt.includes(v + ' '))
    );
  });

  if (hasStrongVerbs) {
    total += 5;
  } else {
    findings.push({
      code: 'cta.language.weak',
      label: 'CTA language lacks strong action verbs -- generic "click here" or "submit" style CTAs',
      pointsLost: 5,
    });
  }

  // --- Chat widget (7 pts) ---
  const hasChatWidget = pages.some((p) => {
    const body = p.bodyText.toLowerCase();
    const linkHrefs = p.links.map((l) => l.href.toLowerCase()).join(' ');
    const linkTexts = p.links.map((l) => l.text.toLowerCase()).join(' ');
    const combined = body + ' ' + linkHrefs + ' ' + linkTexts;
    return CHAT_SIGNALS.some((signal) => combined.includes(signal));
  });

  if (hasChatWidget) {
    total += 7;
  }

  const finalScore = Math.max(0, Math.min(100, total));
  const severity = scoreToSeverity(finalScore);
  const { headline, narrative } = generateNarrative('cta', finalScore, findings.map((f) => f.label));

  return {
    category_id: 'cta',
    category_name: 'Calls to Action',
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
