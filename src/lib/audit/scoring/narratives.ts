import { CategoryResult } from '../types';

const categoryLabels: Record<string, string> = {
  'visual-design': 'Visual Design & Branding',
  'usability': 'Usability & Navigation',
  'cta': 'Calls to Action',
  'seo': 'SEO Fundamentals',
  'performance': 'Performance & Speed',
  'content': 'Content Quality',
  'trust': 'Trust & Credibility',
  'conversion': 'Conversion Architecture',
};

function getSeverity(score: number): 'critical' | 'serious' | 'acceptable' | 'strong' {
  if (score <= 40) return 'critical';
  if (score <= 65) return 'serious';
  if (score <= 85) return 'acceptable';
  return 'strong';
}

function joinFindings(findings: string[], max: number): string {
  const subset = findings.slice(0, max);
  if (subset.length === 0) return '';
  if (subset.length === 1) return subset[0];
  if (subset.length === 2) return `${subset[0]} and ${subset[1]}`;
  return `${subset.slice(0, -1).join(', ')}, and ${subset[subset.length - 1]}`;
}

const categoryNarratives: Record<string, Record<string, { headline: string; narrative: string }>> = {
  'visual-design': {
    critical: {
      headline: 'Your visual presentation is driving visitors away.',
      narrative:
        'Scoring just {score}/100, your site\'s design falls well below modern standards. {findings} These issues make your business look outdated and unprofessional, costing you credibility the moment someone lands on your page.',
    },
    serious: {
      headline: 'Design gaps are undermining your brand image.',
      narrative:
        'At {score}/100, your site has noticeable design deficiencies. {findings} Visitors form opinions in under 50 milliseconds, and these gaps erode trust before they read a single word.',
    },
    acceptable: {
      headline: 'Solid design with room to polish.',
      narrative:
        'Your visual presentation scores {score}/100 -- respectable, but not yet at the level that commands premium perception. {findings}',
    },
    strong: {
      headline: 'Impressive visual execution.',
      narrative:
        'At {score}/100, your site\'s design is well above average. Clean aesthetics and strong branding give visitors immediate confidence in your business.',
    },
  },
  'usability': {
    critical: {
      headline: 'Visitors cannot navigate your site effectively.',
      narrative:
        'A usability score of {score}/100 means people are struggling to find what they need. {findings} Every frustrated visitor is a lost customer walking straight to your competitor.',
    },
    serious: {
      headline: 'Navigation friction is losing you customers.',
      narrative:
        'At {score}/100, your site\'s usability has significant gaps. {findings} Users expect seamless navigation, and these issues create friction that drives them away.',
    },
    acceptable: {
      headline: 'Usable, but not effortless.',
      narrative:
        'Your usability score of {score}/100 shows a functional site with room to streamline. {findings} Small improvements here can meaningfully reduce bounce rates.',
    },
    strong: {
      headline: 'Smooth, intuitive navigation.',
      narrative:
        'At {score}/100, your site delivers a clean navigation experience. Visitors can find what they need quickly, which keeps them engaged and moving toward conversion.',
    },
  },
  'cta': {
    critical: {
      headline: 'Your site has no clear way for visitors to take action.',
      narrative:
        'A CTA score of {score}/100 is alarming. {findings} Without clear calls to action, your website is little more than a digital brochure that generates zero leads.',
    },
    serious: {
      headline: 'Weak calls to action are leaving money on the table.',
      narrative:
        'Scoring {score}/100, your calls to action need serious work. {findings} Every page without a clear next step is a missed opportunity to convert a visitor into a customer.',
    },
    acceptable: {
      headline: 'CTAs are present but could convert harder.',
      narrative:
        'At {score}/100, your site has basic conversion elements in place. {findings} Strengthening and diversifying your calls to action would capture more of the traffic you\'re already getting.',
    },
    strong: {
      headline: 'Strong calls to action throughout.',
      narrative:
        'At {score}/100, your site does a good job guiding visitors toward action. Multiple conversion paths give users clear options to engage with your business.',
    },
  },
  'seo': {
    critical: {
      headline: 'Search engines can barely understand your site.',
      narrative:
        'An SEO score of {score}/100 means your site is virtually invisible to Google. {findings} Without fundamental SEO, you\'re relying entirely on direct traffic and paid ads while competitors get free organic leads.',
    },
    serious: {
      headline: 'SEO gaps are costing you organic visibility.',
      narrative:
        'At {score}/100, your site has notable SEO deficiencies. {findings} These issues suppress your search rankings and hand organic traffic to competitors who have their fundamentals in order.',
    },
    acceptable: {
      headline: 'SEO basics covered, but opportunities remain.',
      narrative:
        'Your SEO score of {score}/100 indicates the fundamentals are mostly in place. {findings} Addressing the remaining gaps could unlock meaningful gains in organic search traffic.',
    },
    strong: {
      headline: 'Strong SEO foundation.',
      narrative:
        'At {score}/100, your site\'s SEO fundamentals are well-executed. Search engines can easily crawl, understand, and rank your content.',
    },
  },
  'performance': {
    critical: {
      headline: 'Your site is painfully slow.',
      narrative:
        'A performance score of {score}/100 means visitors are waiting too long for your pages to load. {findings} Google penalizes slow sites in rankings, and 53% of mobile users abandon pages that take over 3 seconds to load.',
    },
    serious: {
      headline: 'Slow load times are hurting conversions and rankings.',
      narrative:
        'At {score}/100, your site\'s speed is below acceptable thresholds. {findings} Every additional second of load time reduces conversions by an average of 7%.',
    },
    acceptable: {
      headline: 'Decent speed with optimization opportunities.',
      narrative:
        'Your performance score of {score}/100 shows reasonable load times. {findings} Further optimization would improve both user experience and search ranking signals.',
    },
    strong: {
      headline: 'Fast, responsive performance.',
      narrative:
        'At {score}/100, your site loads quickly and responds smoothly. Fast performance keeps visitors engaged and gives you a ranking advantage in search results.',
    },
  },
  'content': {
    critical: {
      headline: 'Your content is too thin to be effective.',
      narrative:
        'A content score of {score}/100 indicates severe deficiencies. {findings} Thin, low-quality content fails to engage visitors, fails to rank in search, and fails to differentiate your business from competitors.',
    },
    serious: {
      headline: 'Content gaps are weakening your site\'s effectiveness.',
      narrative:
        'At {score}/100, your site\'s content needs substantial improvement. {findings} Inadequate content leaves visitors without the information they need to choose your business.',
    },
    acceptable: {
      headline: 'Content is functional but not compelling.',
      narrative:
        'Your content scores {score}/100 -- adequate, but not the kind that builds authority or drives conversions. {findings} Richer content would better serve both search engines and prospective customers.',
    },
    strong: {
      headline: 'Solid content foundation.',
      narrative:
        'At {score}/100, your site has strong content that informs and engages visitors. Quality content like this builds authority and supports organic search performance.',
    },
  },
  'trust': {
    critical: {
      headline: 'Your site raises more questions than confidence.',
      narrative:
        'A trust score of {score}/100 means your site lacks the credibility signals that modern consumers expect. {findings} Without trust indicators, visitors assume the worst and leave.',
    },
    serious: {
      headline: 'Missing trust signals are scaring away prospects.',
      narrative:
        'At {score}/100, your site is missing key elements that build confidence. {findings} In a market where consumers check multiple businesses before buying, these gaps put you at a serious disadvantage.',
    },
    acceptable: {
      headline: 'Credibility established, but gaps remain.',
      narrative:
        'Your trust score of {score}/100 shows you have some credibility elements in place. {findings} Strengthening social proof and transparency would increase conversion rates.',
    },
    strong: {
      headline: 'Strong trust and credibility signals.',
      narrative:
        'At {score}/100, your site does an excellent job building visitor confidence. Clear trust signals and social proof give prospects the reassurance they need to take action.',
    },
  },
  'conversion': {
    critical: {
      headline: 'Your site is not built to convert visitors into customers.',
      narrative:
        'A conversion architecture score of {score}/100 means your site lacks the structural elements needed to generate leads. {findings} Traffic without conversion infrastructure is wasted money.',
    },
    serious: {
      headline: 'Conversion bottlenecks are choking your lead flow.',
      narrative:
        'At {score}/100, your site has significant gaps in its conversion structure. {findings} These structural issues mean you\'re converting only a fraction of the visitors you could be.',
    },
    acceptable: {
      headline: 'Conversion basics in place, optimization needed.',
      narrative:
        'Your conversion architecture scores {score}/100 -- the foundation is there. {findings} Refining your conversion paths could significantly increase the leads your site generates.',
    },
    strong: {
      headline: 'Well-architected for conversions.',
      narrative:
        'At {score}/100, your site is structured to guide visitors toward action. Strong conversion architecture means you\'re capturing more of your traffic as leads.',
    },
  },
};

export function generateNarrative(
  categoryId: string,
  score: number,
  findings: string[]
): { headline: string; narrative: string } {
  const severity = getSeverity(score);
  const templates = categoryNarratives[categoryId];

  if (!templates || !templates[severity]) {
    return {
      headline: `${categoryLabels[categoryId] || categoryId} scored ${score}/100.`,
      narrative: `This category received a score of ${score} out of 100.`,
    };
  }

  const template = templates[severity];
  const findingsText = findings.length > 0 ? joinFindings(findings, 3) + '.' : '';

  const headline = template.headline;
  const narrative = template.narrative
    .replace('{score}', String(score))
    .replace('{findings}', findingsText);

  return { headline, narrative };
}

export function generateOverallNarrative(
  score: number,
  categories: CategoryResult[]
): { headline: string; narrative: string } {
  const sorted = [...categories].sort((a, b) => a.score - b.score);
  const weakest = sorted.slice(0, 3);
  const weakestNames = weakest.map((c) => `${c.category_name} (${c.score}/100)`);
  const weakestStr = joinFindings(weakestNames, 3);

  if (score <= 40) {
    return {
      headline: 'Your website needs urgent, comprehensive attention.',
      narrative:
        `With an overall score of ${score}/100, your website has critical deficiencies across multiple areas. ` +
        `The most pressing problems are in ${weakestStr}. ` +
        `In its current state, your site is likely losing far more customers than it captures. ` +
        `Every day these issues persist, you\'re handing business to competitors with stronger web presence.`,
    };
  }

  if (score <= 65) {
    return {
      headline: 'Significant issues are holding your website back.',
      narrative:
        `Your site scores ${score}/100 overall, placing it below the level needed to compete effectively online. ` +
        `The weakest areas are ${weakestStr}. ` +
        `While not entirely broken, these gaps are measurably reducing the leads and revenue your website should be generating.`,
    };
  }

  if (score <= 85) {
    return {
      headline: 'A solid foundation with clear opportunities.',
      narrative:
        `At ${score}/100, your website is above average but has identifiable areas holding it back from peak performance. ` +
        `The biggest opportunities for improvement lie in ${weakestStr}. ` +
        `Addressing these gaps would meaningfully increase your site\'s ability to attract and convert visitors.`,
    };
  }

  return {
    headline: 'Your website is performing at a high level.',
    narrative:
      `With an overall score of ${score}/100, your website excels across most categories. ` +
      `Even the relatively lower-scoring areas -- ${weakestStr} -- are still performing well. ` +
      `Continued refinement will help maintain this competitive advantage.`,
  };
}
