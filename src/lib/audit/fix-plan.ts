import { AuditResult, CategoryResult } from './types';

export interface FixItem {
  finding: string;
  fix: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  impact: string;
  difficulty: 'easy' | 'moderate' | 'advanced';
  timeEstimate: string;
}

export interface CategoryFixPlan {
  category_id: string;
  category_name: string;
  currentScore: number;
  targetScore: number;
  fixes: FixItem[];
}

export interface FixPlan {
  url: string;
  siteName: string;
  auditDate: string;
  currentScore: number;
  projectedScore: number;
  quickWins: FixItem[];
  categories: CategoryFixPlan[];
}

// Category weights matching the scoring engine
const CATEGORY_WEIGHTS: Record<string, number> = {
  'visual-design': 0.10,
  'usability': 0.10,
  'cta': 0.15,
  'seo': 0.15,
  'performance': 0.10,
  'content': 0.15,
  'trust': 0.15,
  'conversion': 0.10,
};

interface FixPattern {
  test: (finding: string) => boolean;
  fix: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  difficulty: 'easy' | 'moderate' | 'advanced';
  timeEstimate: string;
}

function matches(finding: string, ...substrings: string[]): boolean {
  const lower = finding.toLowerCase();
  return substrings.every((s) => lower.includes(s.toLowerCase()));
}

function matchesAny(finding: string, ...substrings: string[]): boolean {
  const lower = finding.toLowerCase();
  return substrings.some((s) => lower.includes(s.toLowerCase()));
}

// --- Fix pattern definitions per category ---

const visualDesignPatterns: FixPattern[] = [
  {
    test: (f) => matches(f, 'no viewport meta'),
    fix: 'Add `<meta name="viewport" content="width=device-width, initial-scale=1.0">` to every page\'s `<head>`.',
    priority: 'critical',
    difficulty: 'easy',
    timeEstimate: '15 minutes',
  },
  {
    test: (f) => matches(f, 'no favicon'),
    fix: 'Create a 32x32 and 16x16 favicon. Add `<link rel="icon" href="/favicon.ico">` to `<head>`. Use realfavicongenerator.net for all sizes.',
    priority: 'high',
    difficulty: 'easy',
    timeEstimate: '30 minutes',
  },
  {
    test: (f) => matches(f, 'no custom web fonts'),
    fix: 'Choose a professional font pairing (e.g., Montserrat + Inter) from Google Fonts. Add the `<link>` tag to `<head>` and update CSS font-family declarations.',
    priority: 'medium',
    difficulty: 'easy',
    timeEstimate: '1 hour',
  },
  {
    test: (f) => matches(f, 'no images on homepage'),
    fix: 'Add professional hero imagery, team photos, or service photos to the homepage. Use high-quality stock from Unsplash or professional photography.',
    priority: 'high',
    difficulty: 'moderate',
    timeEstimate: '2-4 hours',
  },
  {
    test: (f) => matches(f, 'fewer than 5 unique images'),
    fix: 'Add relevant images throughout the site — service photos, team photos, location shots, before/after images. Aim for 3-5 images per page.',
    priority: 'medium',
    difficulty: 'moderate',
    timeEstimate: '2-4 hours',
  },
  {
    test: (f) => matches(f, 'no responsive images'),
    fix: 'Add srcset attributes to images or use the `<picture>` element for different screen sizes. Use tools like Squoosh to generate multiple sizes.',
    priority: 'medium',
    difficulty: 'moderate',
    timeEstimate: '2-4 hours',
  },
  {
    test: (f) => matches(f, 'h1') && matchesAny(f, 'missing', 'not present'),
    fix: 'Ensure every page has exactly one H1 tag with a unique, descriptive page title. The H1 should describe the page\'s primary topic.',
    priority: 'high',
    difficulty: 'easy',
    timeEstimate: '30 minutes',
  },
  {
    test: (f) => matches(f, 'alt text'),
    fix: 'Add descriptive alt text to every image. Describe what the image shows in context of the page content.',
    priority: 'high',
    difficulty: 'easy',
    timeEstimate: '1-2 hours',
  },
  {
    test: (f) => matches(f, 'no og image'),
    fix: 'Add Open Graph image meta tags: `<meta property="og:image" content="url-to-image.jpg">`. Create a branded 1200x630 share image.',
    priority: 'medium',
    difficulty: 'moderate',
    timeEstimate: '1-2 hours',
  },
  {
    test: (f) => matches(f, 'no modern image formats'),
    fix: 'Convert images to WebP format using tools like Squoosh, Sharp, or your CMS\'s built-in optimizer. WebP provides 25-35% smaller files than JPEG/PNG.',
    priority: 'medium',
    difficulty: 'moderate',
    timeEstimate: '1-2 hours',
  },
  {
    test: (f) => matches(f, 'broken image'),
    fix: 'Fix or replace broken image URLs. Check for typos in src attributes, missing files, or moved assets.',
    priority: 'critical',
    difficulty: 'easy',
    timeEstimate: '30 minutes',
  },
  {
    test: (f) => matches(f, 'font') && matchesAny(f, 'too many', 'more than'),
    fix: 'Reduce to 2-3 font families maximum. Pick one heading font and one body font. Remove unnecessary Google Font imports.',
    priority: 'medium',
    difficulty: 'easy',
    timeEstimate: '1 hour',
  },
];

const usabilityPatterns: FixPattern[] = [
  {
    test: (f) => matchesAny(f, 'no semantic nav', 'no navigation element'),
    fix: 'Add a `<nav>` element wrapping the main navigation. Use `<ul>/<li>` for nav items. Add `role="navigation"` as a fallback.',
    priority: 'high',
    difficulty: 'easy',
    timeEstimate: '30 minutes',
  },
  {
    test: (f) => matches(f, 'nav') && matches(f, 'not consistent'),
    fix: 'Ensure the same navigation menu appears on every page. Use a shared header/nav component or template partial.',
    priority: 'high',
    difficulty: 'moderate',
    timeEstimate: '1-2 hours',
  },
  {
    test: (f) => matchesAny(f, 'click depth', 'not all within 2'),
    fix: 'Flatten the site structure. Add important pages directly to the main navigation. Consider adding a sitemap page or footer navigation with all key pages.',
    priority: 'medium',
    difficulty: 'moderate',
    timeEstimate: '1-2 hours',
  },
  {
    test: (f) => matches(f, 'broken link'),
    fix: 'Use a tool like Screaming Frog or Dead Link Checker to find all broken links. Fix or remove each one. Update any links to pages that have moved.',
    priority: 'critical',
    difficulty: 'easy',
    timeEstimate: '1-2 hours',
  },
  {
    test: (f) => matchesAny(f, 'internal linking', 'links per page'),
    fix: 'Add contextual internal links within page content. Link related pages together. Add "Related Services" or "Learn More" sections. Aim for 5+ internal links per page.',
    priority: 'high',
    difficulty: 'moderate',
    timeEstimate: '2-4 hours',
  },
  {
    test: (f) => matches(f, 'skip navigation'),
    fix: 'Add a skip nav link as the first element in `<body>`: `<a href="#main" class="skip-link">Skip to main content</a>`. Style it to appear only on focus.',
    priority: 'medium',
    difficulty: 'easy',
    timeEstimate: '30 minutes',
  },
  {
    test: (f) => matches(f, 'accessibility') && matchesAny(f, 'critical', 'serious'),
    fix: 'Run axe DevTools in Chrome and fix violations. Common fixes: add form labels, fix color contrast, add ARIA attributes to interactive elements.',
    priority: 'critical',
    difficulty: 'moderate',
    timeEstimate: '2-4 hours',
  },
  {
    test: (f) => matches(f, 'tap target'),
    fix: 'Increase the size of clickable elements to at least 44x44px on mobile. Add padding to links and buttons.',
    priority: 'high',
    difficulty: 'easy',
    timeEstimate: '1 hour',
  },
  {
    test: (f) => matches(f, 'title') && matchesAny(f, 'not descriptive', 'generic', 'empty'),
    fix: 'Write unique, descriptive title tags for each page (50-60 characters). Format: "Page Topic | Brand Name".',
    priority: 'high',
    difficulty: 'easy',
    timeEstimate: '1 hour',
  },
  {
    test: (f) => matches(f, 'breadcrumb'),
    fix: 'Add breadcrumb navigation showing the page hierarchy. Use schema.org BreadcrumbList markup.',
    priority: 'low',
    difficulty: 'moderate',
    timeEstimate: '1-2 hours',
  },
  {
    test: (f) => matches(f, 'footer') && matches(f, 'links'),
    fix: 'Add a comprehensive footer with links to key pages, contact info, social media, and legal pages.',
    priority: 'medium',
    difficulty: 'easy',
    timeEstimate: '1-2 hours',
  },
];

const ctaPatterns: FixPattern[] = [
  {
    test: (f) => matches(f, 'no cta') && matches(f, 'homepage'),
    fix: 'Add a prominent call-to-action button above the fold on the homepage. Use action-oriented text like "Get a Free Quote", "Schedule a Call", or "Contact Us Today".',
    priority: 'critical',
    difficulty: 'easy',
    timeEstimate: '30 minutes',
  },
  {
    test: (f) => matches(f, 'no contact form'),
    fix: 'Add a contact form with name, email, phone, and message fields. Use a form service like HubSpot, Typeform, or JotForm if you don\'t have server-side form handling.',
    priority: 'critical',
    difficulty: 'moderate',
    timeEstimate: '1-2 hours',
  },
  {
    test: (f) => matches(f, 'no phone number'),
    fix: 'Add a clickable phone number in the header and footer of every page. Use `<a href="tel:+1234567890">` for mobile tap-to-call.',
    priority: 'critical',
    difficulty: 'easy',
    timeEstimate: '15 minutes',
  },
  {
    test: (f) => matches(f, 'no email'),
    fix: 'Add a clickable email address in the header/footer and contact page. Use `<a href="mailto:info@domain.com">`.',
    priority: 'high',
    difficulty: 'easy',
    timeEstimate: '15 minutes',
  },
  {
    test: (f) => matchesAny(f, 'cta keyword', 'only 1', 'only one'),
    fix: 'Diversify CTAs across the site. Use different action words: "Get Started", "Book a Call", "Request a Quote", "Learn More", "See Pricing".',
    priority: 'high',
    difficulty: 'easy',
    timeEstimate: '1 hour',
  },
  {
    test: (f) => matches(f, 'cta') && matches(f, 'only') && matchesAny(f, '1 page', 'one page', 'homepage'),
    fix: 'Add CTAs to every page, not just the homepage. Each service page should have its own relevant CTA.',
    priority: 'high',
    difficulty: 'easy',
    timeEstimate: '1-2 hours',
  },
  {
    test: (f) => matches(f, 'no dedicated contact page'),
    fix: 'Create a standalone /contact page with a form, phone number, email, physical address, and a map embed.',
    priority: 'high',
    difficulty: 'moderate',
    timeEstimate: '1-2 hours',
  },
  {
    test: (f) => matches(f, 'no chat widget'),
    fix: 'Add a live chat or chatbot widget (Tidio, Drift, Intercom, or Crisp have free tiers). This captures visitors who won\'t fill out a form.',
    priority: 'medium',
    difficulty: 'easy',
    timeEstimate: '30 minutes',
  },
  {
    test: (f) => matchesAny(f, 'multiple conversion', 'conversion path'),
    fix: 'Ensure visitors have multiple ways to convert: form, phone, email, and chat. Not everyone prefers the same channel.',
    priority: 'high',
    difficulty: 'moderate',
    timeEstimate: '1-2 hours',
  },
];

const seoPatterns: FixPattern[] = [
  {
    test: (f) => matches(f, 'title tag') && matchesAny(f, 'missing', 'without'),
    fix: 'Add unique `<title>` tags to every page. Format: "Primary Keyword - Secondary Keyword | Brand Name". Keep under 60 characters.',
    priority: 'critical',
    difficulty: 'easy',
    timeEstimate: '30 minutes per page',
  },
  {
    test: (f) => matches(f, 'title') && matchesAny(f, 'duplicate', 'not unique'),
    fix: 'Write unique title tags for each page. Each title should reflect that specific page\'s content and target keywords.',
    priority: 'high',
    difficulty: 'easy',
    timeEstimate: '1 hour',
  },
  {
    test: (f) => matches(f, 'meta description') && matchesAny(f, 'missing', 'without'),
    fix: 'Write compelling meta descriptions for every page (150-160 characters). Include a call-to-action and target keywords.',
    priority: 'high',
    difficulty: 'easy',
    timeEstimate: '30 minutes per page',
  },
  {
    test: (f) => matches(f, 'meta description') && matchesAny(f, 'duplicate', 'not unique'),
    fix: 'Write unique meta descriptions for each page that summarize the specific page content.',
    priority: 'high',
    difficulty: 'easy',
    timeEstimate: '1 hour',
  },
  {
    test: (f) => matches(f, 'h1') && matchesAny(f, 'missing', 'multiple', 'more than'),
    fix: 'Ensure exactly one H1 per page. The H1 should contain the page\'s primary keyword naturally.',
    priority: 'high',
    difficulty: 'easy',
    timeEstimate: '30 minutes',
  },
  {
    test: (f) => matchesAny(f, 'heading hierarchy', 'skipped level'),
    fix: 'Fix heading levels to flow logically: H1 -> H2 -> H3. Don\'t skip from H1 to H3. Use CSS for visual sizing instead of heading levels.',
    priority: 'medium',
    difficulty: 'easy',
    timeEstimate: '1 hour',
  },
  {
    test: (f) => matches(f, 'sitemap'),
    fix: 'Create an XML sitemap and submit it to Google Search Console. Most CMS platforms generate this automatically. For static sites, use a sitemap generator tool.',
    priority: 'high',
    difficulty: 'easy',
    timeEstimate: '30 minutes',
  },
  {
    test: (f) => matches(f, 'robots.txt'),
    fix: 'Create a robots.txt file in the site root. At minimum: `User-agent: *\\nAllow: /\\nSitemap: https://yourdomain.com/sitemap.xml`.',
    priority: 'medium',
    difficulty: 'easy',
    timeEstimate: '15 minutes',
  },
  {
    test: (f) => matches(f, 'canonical'),
    fix: 'Add `<link rel="canonical" href="https://yourdomain.com/page-url">` to every page\'s `<head>` to prevent duplicate content issues.',
    priority: 'medium',
    difficulty: 'easy',
    timeEstimate: '30 minutes',
  },
  {
    test: (f) => matchesAny(f, 'structured data', 'json-ld'),
    fix: 'Add JSON-LD structured data for your business type (LocalBusiness, Organization, etc.). Use Google\'s Structured Data Markup Helper to generate the code.',
    priority: 'high',
    difficulty: 'moderate',
    timeEstimate: '1-2 hours',
  },
  {
    test: (f) => matchesAny(f, 'open graph', 'og tag'),
    fix: 'Add OG tags to every page: og:title, og:description, og:image, og:url, og:type. This controls how pages appear when shared on social media.',
    priority: 'medium',
    difficulty: 'easy',
    timeEstimate: '30 minutes per page',
  },
  {
    test: (f) => matchesAny(f, 'orphan', 'isolated page'),
    fix: 'Add internal links pointing to isolated pages from related content pages. Ensure every page has at least 2-3 internal links pointing to it.',
    priority: 'medium',
    difficulty: 'easy',
    timeEstimate: '1 hour',
  },
  {
    test: (f) => matches(f, 'title') && matches(f, 'length'),
    fix: 'Adjust title tags to 30-60 characters. Too short means missed keyword opportunity, too long gets truncated in search results.',
    priority: 'medium',
    difficulty: 'easy',
    timeEstimate: '30 minutes',
  },
];

const performancePatterns: FixPattern[] = [
  {
    test: (f) => matches(f, 'lighthouse') && matchesAny(f, 'poor', 'below'),
    fix: 'Run Lighthouse in Chrome DevTools, address the top opportunities it identifies: image compression, code splitting, removing unused CSS/JS.',
    priority: 'critical',
    difficulty: 'advanced',
    timeEstimate: 'half day',
  },
  {
    test: (f) => matchesAny(f, 'lcp', 'largest contentful paint'),
    fix: 'Optimize the largest above-fold element (usually a hero image). Compress images, use WebP, add width/height attributes, and preload the hero image with `<link rel="preload">`.',
    priority: 'critical',
    difficulty: 'moderate',
    timeEstimate: '2-4 hours',
  },
  {
    test: (f) => matchesAny(f, 'cls', 'layout shift'),
    fix: 'Add explicit width/height attributes to all images and embeds. Reserve space for ads/dynamic content. Use CSS aspect-ratio.',
    priority: 'high',
    difficulty: 'moderate',
    timeEstimate: '1-2 hours',
  },
  {
    test: (f) => matchesAny(f, 'fcp', 'first contentful paint'),
    fix: 'Reduce server response time, inline critical CSS, defer non-essential JavaScript, and use font-display: swap for web fonts.',
    priority: 'high',
    difficulty: 'advanced',
    timeEstimate: '2-4 hours',
  },
  {
    test: (f) => matchesAny(f, 'tbt', 'total blocking time'),
    fix: 'Reduce JavaScript execution time. Defer non-critical scripts, code-split large bundles, and remove unused JavaScript. Use `async` or `defer` on script tags.',
    priority: 'high',
    difficulty: 'advanced',
    timeEstimate: 'half day',
  },
  {
    test: (f) => matches(f, 'speed index'),
    fix: 'Optimize the critical rendering path. Inline above-fold CSS, defer below-fold resources, preload key assets, and minimize render-blocking resources.',
    priority: 'high',
    difficulty: 'advanced',
    timeEstimate: 'half day',
  },
  {
    test: (f) => matchesAny(f, 'not consistent', 'below 50'),
    fix: 'Address performance issues on the slowest pages first. Each page may have different bottlenecks — analyze them individually with PageSpeed Insights.',
    priority: 'high',
    difficulty: 'moderate',
    timeEstimate: '2-4 hours',
  },
  {
    test: (f) => matches(f, 'performance data') && matches(f, 'not'),
    fix: 'Investigate why PageSpeed Insights couldn\'t analyze the site. Common causes: server timeouts, overly aggressive rate limiting, or sites that block Google\'s testing bot.',
    priority: 'critical',
    difficulty: 'advanced',
    timeEstimate: '1-2 hours',
  },
];

const contentPatterns: FixPattern[] = [
  {
    test: (f) => matches(f, 'thin') && matches(f, 'page'),
    fix: 'Expand thin pages to at least 300 words of useful, original content. Add relevant information, FAQs, or detailed descriptions of services/products.',
    priority: 'high',
    difficulty: 'moderate',
    timeEstimate: '1-2 hours per page',
  },
  {
    test: (f) => matches(f, 'homepage') && matchesAny(f, 'word', 'content'),
    fix: 'Expand homepage content to 500+ words. Include your value proposition, key services, social proof, and a clear CTA. Don\'t rely solely on images and one-liners.',
    priority: 'critical',
    difficulty: 'moderate',
    timeEstimate: '2-4 hours',
  },
  {
    test: (f) => matches(f, 'empty page'),
    fix: 'Either add meaningful content to empty pages or remove/redirect them. A page with no content hurts your SEO and wastes visitors\' time.',
    priority: 'critical',
    difficulty: 'easy',
    timeEstimate: '1 hour per page',
  },
  {
    test: (f) => matches(f, 'duplicate title'),
    fix: 'Write unique titles for each page. Duplicate titles signal to search engines that pages may have duplicate content.',
    priority: 'high',
    difficulty: 'easy',
    timeEstimate: '1 hour',
  },
  {
    test: (f) => matches(f, 'broken image'),
    fix: 'Fix or replace all broken images. Use a link checker to identify them, then update src attributes or upload replacement images.',
    priority: 'high',
    difficulty: 'easy',
    timeEstimate: '30 minutes',
  },
  {
    test: (f) => matchesAny(f, 'blog', 'content section'),
    fix: 'Start a blog or news section. Publish 2-4 articles per month on topics your customers search for. This drives organic traffic and establishes authority.',
    priority: 'medium',
    difficulty: 'advanced',
    timeEstimate: 'ongoing',
  },
  {
    test: (f) => matches(f, 'copyright') && matches(f, 'year'),
    fix: 'Update the copyright year in the footer to the current year. Set it to update automatically with JavaScript or server-side code.',
    priority: 'low',
    difficulty: 'easy',
    timeEstimate: '5 minutes',
  },
  {
    test: (f) => matches(f, 'meta description') && matchesAny(f, 'short', 'length', 'placeholder'),
    fix: 'Write proper meta descriptions of 120-160 characters that summarize the page content and include a call-to-action.',
    priority: 'medium',
    difficulty: 'easy',
    timeEstimate: '30 minutes per page',
  },
  {
    test: (f) => matchesAny(f, 'content depth') || (matches(f, 'fewer than') && matches(f, 'page')),
    fix: 'Add more pages to the site covering your services, FAQ, about your team, process, case studies, and service areas.',
    priority: 'medium',
    difficulty: 'moderate',
    timeEstimate: 'ongoing',
  },
  {
    test: (f) => matchesAny(f, 'uniform', 'template'),
    fix: 'Differentiate page content. Each page should have unique text, not just the same template with a word swapped out.',
    priority: 'medium',
    difficulty: 'moderate',
    timeEstimate: '2-4 hours',
  },
];

const trustPatterns: FixPattern[] = [
  {
    test: (f) => matchesAny(f, 'not using https', 'ssl'),
    fix: 'Install an SSL certificate (free from Let\'s Encrypt) and redirect all HTTP traffic to HTTPS. Most hosts provide one-click SSL setup.',
    priority: 'critical',
    difficulty: 'easy',
    timeEstimate: '30 minutes',
  },
  {
    test: (f) => matches(f, 'no privacy policy'),
    fix: 'Add a privacy policy page. Use a free generator like TermsFeed or Termly, then customize it for your business. Link to it in the footer.',
    priority: 'critical',
    difficulty: 'easy',
    timeEstimate: '1 hour',
  },
  {
    test: (f) => matches(f, 'no terms'),
    fix: 'Add a Terms of Service page. Use a template generator and customize. Link in the footer alongside the privacy policy.',
    priority: 'medium',
    difficulty: 'easy',
    timeEstimate: '1 hour',
  },
  {
    test: (f) => matches(f, 'no contact page'),
    fix: 'Create a dedicated /contact page with your phone number, email, physical address, business hours, and a contact form.',
    priority: 'critical',
    difficulty: 'easy',
    timeEstimate: '1-2 hours',
  },
  {
    test: (f) => matches(f, 'no physical address'),
    fix: 'Add your business address to the footer and contact page. If you operate from home, use a P.O. Box or virtual office address. This is critical for local SEO trust.',
    priority: 'high',
    difficulty: 'easy',
    timeEstimate: '15 minutes',
  },
  {
    test: (f) => matches(f, 'social media') && matchesAny(f, 'missing', 'no'),
    fix: 'Create profiles on relevant platforms (at minimum: Google Business, LinkedIn, Facebook). Add social media icon links to your header or footer.',
    priority: 'high',
    difficulty: 'easy',
    timeEstimate: '1 hour',
  },
  {
    test: (f) => matchesAny(f, 'no testimonial', 'no review'),
    fix: 'Add a testimonials section with real client quotes, names, and (ideally) photos. Add Google/Yelp review widgets. Ask satisfied clients for written testimonials.',
    priority: 'critical',
    difficulty: 'moderate',
    timeEstimate: '2-4 hours',
  },
  {
    test: (f) => matchesAny(f, 'no business schema', 'schema markup'),
    fix: 'Add LocalBusiness or Organization JSON-LD schema to your homepage. Include name, address, phone, hours, and logo. Use Google\'s Structured Data Markup Helper.',
    priority: 'high',
    difficulty: 'moderate',
    timeEstimate: '1-2 hours',
  },
  {
    test: (f) => matches(f, 'no about page'),
    fix: 'Create an About page with your story, team bios, mission, and credentials. People buy from people they trust — show the humans behind the business.',
    priority: 'high',
    difficulty: 'moderate',
    timeEstimate: '2-4 hours',
  },
  {
    test: (f) => matches(f, 'no google business'),
    fix: 'Create or claim your Google Business Profile. This is free and critical for local search visibility and credibility.',
    priority: 'critical',
    difficulty: 'easy',
    timeEstimate: '1 hour',
  },
  {
    test: (f) => matchesAny(f, 'no certif', 'no license'),
    fix: 'Add a section highlighting licenses, certifications, insurance, awards, or accreditations. These are powerful trust signals.',
    priority: 'medium',
    difficulty: 'easy',
    timeEstimate: '30 minutes',
  },
  {
    test: (f) => matchesAny(f, 'bbb', 'trust badge'),
    fix: 'Join the Better Business Bureau or your local Chamber of Commerce. Display their badges on your site.',
    priority: 'low',
    difficulty: 'easy',
    timeEstimate: '30 minutes (plus membership)',
  },
];

const conversionPatterns: FixPattern[] = [
  {
    test: (f) => matches(f, 'no form'),
    fix: 'Add at least one contact/inquiry form to the site. Keep it simple: name, email, phone, message. Use a service like HubSpot (free) or Typeform.',
    priority: 'critical',
    difficulty: 'moderate',
    timeEstimate: '1-2 hours',
  },
  {
    test: (f) => matches(f, 'form') && matchesAny(f, 'too many', 'friction', 'more than 8'),
    fix: 'Simplify your form to 5 or fewer fields. Only ask for what you truly need upfront. You can gather more info after initial contact.',
    priority: 'high',
    difficulty: 'easy',
    timeEstimate: '30 minutes',
  },
  {
    test: (f) => matchesAny(f, 'conversion path', 'multiple'),
    fix: 'Offer multiple ways to convert on every page: form, phone number, email, and chat widget. Not everyone prefers the same contact method.',
    priority: 'high',
    difficulty: 'moderate',
    timeEstimate: '1-2 hours',
  },
  {
    test: (f) => matches(f, 'social proof') && matches(f, 'cta'),
    fix: 'Place testimonials, review scores, or trust badges near your CTAs. "Join 500+ satisfied customers" next to a contact form dramatically increases conversion.',
    priority: 'high',
    difficulty: 'moderate',
    timeEstimate: '1-2 hours',
  },
  {
    test: (f) => matchesAny(f, 'value proposition') || (matches(f, 'h1') && matchesAny(f, 'short', 'generic')),
    fix: 'Write a clear, specific H1 headline on the homepage that communicates what you do, who it\'s for, and why you\'re different. Aim for 8-15 words.',
    priority: 'critical',
    difficulty: 'easy',
    timeEstimate: '30 minutes',
  },
  {
    test: (f) => matchesAny(f, 'above-fold') || (matches(f, 'homepage') && matches(f, 'missing')),
    fix: 'Ensure the homepage has three elements above the fold: a clear H1 headline, supporting text (1-2 sentences), and a prominent CTA button.',
    priority: 'critical',
    difficulty: 'easy',
    timeEstimate: '1 hour',
  },
  {
    test: (f) => matchesAny(f, 'thank-you', 'confirmation'),
    fix: 'Create a thank-you page that appears after form submission. This confirms the action, sets expectations ("We\'ll respond within 24 hours"), and can offer additional value.',
    priority: 'medium',
    difficulty: 'easy',
    timeEstimate: '1 hour',
  },
  {
    test: (f) => matchesAny(f, 'lead magnet', 'no special offer'),
    fix: 'Create a lead magnet (free guide, checklist, or consultation) to capture emails from visitors who aren\'t ready to buy yet.',
    priority: 'medium',
    difficulty: 'moderate',
    timeEstimate: '2-4 hours',
  },
  {
    test: (f) => matchesAny(f, 'pricing', 'quote', 'estimate'),
    fix: 'Add a clear path to pricing: either a pricing page, a "Get a Quote" form, or a "See Pricing" CTA. Hidden pricing creates friction.',
    priority: 'high',
    difficulty: 'easy',
    timeEstimate: '1 hour',
  },
];

// Map category IDs to their pattern sets
const CATEGORY_PATTERNS: Record<string, FixPattern[]> = {
  'visual-design': visualDesignPatterns,
  'usability': usabilityPatterns,
  'cta': ctaPatterns,
  'seo': seoPatterns,
  'performance': performancePatterns,
  'content': contentPatterns,
  'trust': trustPatterns,
  'conversion': conversionPatterns,
};

// Generic fallback fix messages per category
const GENERIC_FIXES: Record<string, string> = {
  'visual-design': 'Review and improve the visual presentation of this element. Ensure it follows modern web design best practices and maintains brand consistency.',
  'usability': 'Improve this aspect of site usability. Test on multiple devices and browsers to ensure a smooth user experience.',
  'cta': 'Strengthen this call-to-action element. Ensure it is visually prominent, uses action-oriented language, and is easy to find on every page.',
  'seo': 'Address this SEO issue to improve search engine visibility. Follow Google\'s Webmaster Guidelines for best practices.',
  'performance': 'Optimize this performance issue. Use Chrome DevTools Performance tab and Lighthouse to identify and resolve the specific bottleneck.',
  'content': 'Improve the quality and depth of this content. Ensure it provides genuine value to visitors and supports your business goals.',
  'trust': 'Strengthen this trust signal. Visitors need to feel confident in your business before they will convert.',
  'conversion': 'Optimize this conversion element. Test different approaches and measure which version drives more inquiries or sales.',
};

function priorityRank(priority: 'critical' | 'high' | 'medium' | 'low'): number {
  switch (priority) {
    case 'critical': return 4;
    case 'high': return 3;
    case 'medium': return 2;
    case 'low': return 1;
  }
}

function estimatePointsPerFix(categoryScore: number, totalFindings: number): number {
  const pointsAvailable = 95 - categoryScore;
  if (totalFindings === 0) return 0;
  return Math.round((pointsAvailable / totalFindings) * 10) / 10;
}

function buildFixItem(
  finding: string,
  categoryId: string,
  categoryScore: number,
  totalFindings: number
): FixItem {
  const patterns = CATEGORY_PATTERNS[categoryId] || [];
  const pointsPerFix = estimatePointsPerFix(categoryScore, totalFindings);

  for (const pattern of patterns) {
    if (pattern.test(finding)) {
      return {
        finding,
        fix: pattern.fix,
        priority: pattern.priority,
        impact: `Could add ~${pointsPerFix} points to ${formatCategoryName(categoryId)} score`,
        difficulty: pattern.difficulty,
        timeEstimate: pattern.timeEstimate,
      };
    }
  }

  // No pattern matched — generate a generic fix
  const genericFix = GENERIC_FIXES[categoryId] || 'Address this issue to improve the overall site quality.';
  return {
    finding,
    fix: `${genericFix} Specifically: "${finding}".`,
    priority: 'medium',
    impact: `Could add ~${pointsPerFix} points to ${formatCategoryName(categoryId)} score`,
    difficulty: 'moderate',
    timeEstimate: '1-2 hours',
  };
}

function formatCategoryName(categoryId: string): string {
  const names: Record<string, string> = {
    'visual-design': 'Visual Design & Branding',
    'usability': 'Usability & Navigation',
    'cta': 'Calls to Action',
    'seo': 'SEO Fundamentals',
    'performance': 'Performance & Speed',
    'content': 'Content Quality',
    'trust': 'Trust & Credibility',
    'conversion': 'Conversion Architecture',
  };
  return names[categoryId] || categoryId;
}

function buildCategoryFixPlan(category: CategoryResult): CategoryFixPlan {
  const fixes = category.findings.map((finding) =>
    buildFixItem(finding, category.category_id, category.score, category.findings.length)
  );

  const pointsAvailable = 95 - category.score;
  const targetScore = Math.min(95, category.score + pointsAvailable);

  return {
    category_id: category.category_id,
    category_name: category.category_name,
    currentScore: category.score,
    targetScore,
    fixes,
  };
}

function calculateProjectedOverall(categoryPlans: CategoryFixPlan[]): number {
  let weightedSum = 0;
  let totalWeight = 0;

  for (const plan of categoryPlans) {
    const weight = CATEGORY_WEIGHTS[plan.category_id] || 0.1;
    weightedSum += plan.targetScore * weight;
    totalWeight += weight;
  }

  if (totalWeight === 0) return 0;
  return Math.round(weightedSum / totalWeight);
}

function extractQuickWins(categoryPlans: CategoryFixPlan[]): FixItem[] {
  const candidates: FixItem[] = [];

  for (const plan of categoryPlans) {
    for (const fix of plan.fixes) {
      if (fix.difficulty === 'easy' && (fix.priority === 'critical' || fix.priority === 'high')) {
        candidates.push(fix);
      }
    }
  }

  // Sort by priority (critical first), then by impact string (higher point numbers first)
  candidates.sort((a, b) => {
    const priorityDiff = priorityRank(b.priority) - priorityRank(a.priority);
    if (priorityDiff !== 0) return priorityDiff;

    // Extract point numbers from impact strings for secondary sort
    const aPoints = parseFloat(a.impact.match(/~([\d.]+)/)?.[1] || '0');
    const bPoints = parseFloat(b.impact.match(/~([\d.]+)/)?.[1] || '0');
    return bPoints - aPoints;
  });

  return candidates.slice(0, 5);
}

export function generateFixPlan(result: AuditResult): FixPlan {
  const categoryPlans = result.categories.map(buildCategoryFixPlan);
  const projectedScore = calculateProjectedOverall(categoryPlans);
  const quickWins = extractQuickWins(categoryPlans);

  return {
    url: result.url,
    siteName: result.siteName,
    auditDate: result.auditDate,
    currentScore: result.overall_score,
    projectedScore,
    quickWins,
    categories: categoryPlans,
  };
}
