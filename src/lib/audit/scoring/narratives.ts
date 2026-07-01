import { CategoryResult } from '../types';

/**
 * Client-facing narrative copy for the audit report.
 *
 * Voice: firm and direct about what's wrong (never insulting), written at
 * roughly a 5-year-old reading level -- short sentences, plain words, no
 * jargon. These narratives describe PROBLEMS and their COST. They never
 * contain fix instructions or "how to" language; that lives in a separate,
 * internal fix-plan module.
 */

const categoryLabels: Record<string, string> = {
  'visual-design': 'Visual Design & Branding',
  'usability': 'Usability & Navigation',
  'cta': 'Calls to Action',
  'seo': 'SEO Fundamentals',
  'performance': 'Performance & Speed',
  'content': 'Content Quality',
  'trust': 'Trust & Credibility',
  'conversion': 'Conversion Architecture',
  'aeo': 'AI Search (AEO)',
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
      headline: 'Your site looks unfinished, and that turns people away.',
      narrative:
        'This part scored {score} out of 100. {findings} People decide how they feel about a business in seconds, just from how the page looks. Right now, your site is losing that first impression before anyone reads a word.',
    },
    serious: {
      headline: 'The look of your site is holding it back.',
      narrative:
        'This part scored {score} out of 100. {findings} These are the kind of small things people notice without realizing it, and they quietly chip away at trust.',
    },
    acceptable: {
      headline: 'The design is solid, with a few rough edges.',
      narrative:
        'This part scored {score} out of 100 -- a good starting point, not a finished one. {findings}',
    },
    strong: {
      headline: 'Your site looks sharp.',
      narrative:
        'This part scored {score} out of 100. The design is clean and well put-together, which gives visitors confidence right away.',
    },
  },
  'usability': {
    critical: {
      headline: 'People get lost trying to use your site.',
      narrative:
        'This part scored {score} out of 100. {findings} When people can\'t find what they\'re looking for, they don\'t stick around and figure it out -- they just leave.',
    },
    serious: {
      headline: 'Getting around your site takes more effort than it should.',
      narrative:
        'This part scored {score} out of 100. {findings} People expect a site to be easy to use. Every extra bit of friction is another reason for them to give up.',
    },
    acceptable: {
      headline: 'Your site works, but it could be smoother.',
      narrative:
        'This part scored {score} out of 100 -- functional, with room to improve. {findings} Small fixes here go a long way toward keeping people around.',
    },
    strong: {
      headline: 'Your site is easy to get around.',
      narrative:
        'This part scored {score} out of 100. People can find what they need quickly, which keeps them engaged instead of frustrated.',
    },
  },
  'cta': {
    critical: {
      headline: 'Your site never tells visitors what to do next.',
      narrative:
        'This part scored {score} out of 100. {findings} Without a clear next step, your site is just a brochure -- people read it and leave, instead of reaching out.',
    },
    serious: {
      headline: 'Your calls to action are too easy to miss.',
      narrative:
        'This part scored {score} out of 100. {findings} Every page without an obvious next step is a missed chance to turn a visitor into a customer.',
    },
    acceptable: {
      headline: 'The basics are there, but they could push harder.',
      narrative:
        'This part scored {score} out of 100. {findings} Making your calls to action clearer and more inviting would turn more of your existing visitors into leads.',
    },
    strong: {
      headline: 'Your calls to action are clear and effective.',
      narrative:
        'This part scored {score} out of 100. Visitors are given a clear next step, with more than one way to take it.',
    },
  },
  'seo': {
    critical: {
      headline: 'Google barely knows your site exists.',
      narrative:
        'This part scored {score} out of 100. {findings} Without the basics in place, you\'re invisible in search -- competitors with the fundamentals covered get the free traffic instead.',
    },
    serious: {
      headline: 'Search engines are struggling to understand your site.',
      narrative:
        'This part scored {score} out of 100. {findings} These gaps hold your rankings down and send organic visitors to competitors instead.',
    },
    acceptable: {
      headline: 'The fundamentals are mostly covered.',
      narrative:
        'This part scored {score} out of 100. {findings} Closing the remaining gaps could bring in noticeably more search traffic.',
    },
    strong: {
      headline: 'Search engines understand your site well.',
      narrative:
        'This part scored {score} out of 100. Google can crawl, understand, and rank your content without trouble.',
    },
  },
  'performance': {
    critical: {
      headline: 'Your site is too slow, and it is costing you visitors.',
      narrative:
        'This part scored {score} out of 100. {findings} Most people won\'t wait for a slow page to load -- they just leave. Google also ranks slow sites lower.',
    },
    serious: {
      headline: 'Slow load times are pushing people away.',
      narrative:
        'This part scored {score} out of 100. {findings} Every extra second of loading loses you more visitors and hurts your search rankings.',
    },
    acceptable: {
      headline: 'Your site loads fine, but not fast.',
      narrative:
        'This part scored {score} out of 100. {findings} Shaving off more load time would keep more visitors around and help your search rankings too.',
    },
    strong: {
      headline: 'Your site loads fast.',
      narrative:
        'This part scored {score} out of 100. Pages load quickly and respond right away, which keeps visitors engaged.',
    },
  },
  'content': {
    critical: {
      headline: 'There is not enough on your site to convince anyone.',
      narrative:
        'This part scored {score} out of 100. {findings} Thin content gives people little reason to stay, and gives Google little reason to rank you.',
    },
    serious: {
      headline: 'Your content needs more substance.',
      narrative:
        'This part scored {score} out of 100. {findings} Visitors need enough information to decide to choose you -- right now, most of them don\'t get it.',
    },
    acceptable: {
      headline: 'The content is there, but it is not doing much work for you.',
      narrative:
        'This part scored {score} out of 100 -- adequate, not compelling. {findings} Stronger content would do more to build trust and bring in search traffic.',
    },
    strong: {
      headline: 'Your content does its job well.',
      narrative:
        'This part scored {score} out of 100. It gives visitors real information and gives search engines real reasons to rank you.',
    },
  },
  'trust': {
    critical: {
      headline: 'Your site does not give people a reason to trust you yet.',
      narrative:
        'This part scored {score} out of 100. {findings} When people don\'t see signs a business is real and trustworthy, they assume the worst and leave.',
    },
    serious: {
      headline: 'Missing trust signals are costing you sales.',
      narrative:
        'This part scored {score} out of 100. {findings} People check for these signals before they buy from a business they don\'t already know.',
    },
    acceptable: {
      headline: 'You have some trust built in, but there are gaps.',
      narrative:
        'This part scored {score} out of 100. {findings} A few more of these signals would make people more comfortable saying yes.',
    },
    strong: {
      headline: 'Your site earns trust quickly.',
      narrative:
        'This part scored {score} out of 100. The signals that make people comfortable doing business with you are all in place.',
    },
  },
  'conversion': {
    critical: {
      headline: 'Your site is not set up to turn visitors into customers.',
      narrative:
        'This part scored {score} out of 100. {findings} Bringing people to a site that isn\'t built to convert them means paying for traffic that goes nowhere.',
    },
    serious: {
      headline: 'Real gaps are keeping visitors from becoming leads.',
      narrative:
        'This part scored {score} out of 100. {findings} These gaps mean you\'re only converting a fraction of the people who could become customers.',
    },
    acceptable: {
      headline: 'The basics are in place, but there is more to capture.',
      narrative:
        'This part scored {score} out of 100 -- a real foundation. {findings} Tightening these paths could bring in noticeably more leads from the traffic you already have.',
    },
    strong: {
      headline: 'Your site is built to convert.',
      narrative:
        'This part scored {score} out of 100. Visitors are guided clearly toward becoming customers.',
    },
  },
  'aeo': {
    critical: {
      headline: 'AI tools like ChatGPT do not know your business exists.',
      narrative:
        'This part scored {score} out of 100. {findings} More people are asking AI tools for recommendations instead of searching Google. Right now, those tools have nothing to go on, so they never mention you.',
    },
    serious: {
      headline: 'AI search tools are missing key facts about your business.',
      narrative:
        'This part scored {score} out of 100. {findings} AI tools need clear, direct information to trust and recommend a business. Without it, they guess, or they skip you for a competitor who made it easy.',
    },
    acceptable: {
      headline: 'AI tools can find some of what they need.',
      narrative:
        'This part scored {score} out of 100. {findings} Filling in the remaining gaps would make it easier for AI tools to understand and recommend your business with confidence.',
    },
    strong: {
      headline: 'AI tools can understand and recommend your business.',
      narrative:
        'This part scored {score} out of 100. The clear facts and structure in place make it easy for AI tools to confidently mention your business in their answers.',
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
      headline: 'Right now, your website is costing you more customers than it brings in.',
      narrative:
        `Your site scored ${score} out of 100 overall. That's a serious number -- it means real, ` +
        `fixable problems are showing up across the board, not just in one corner of the site. ` +
        `The biggest ones right now are in ${weakestStr}. ` +
        `Every day this sits as-is, people land on your site, get a bad first impression, and go find ` +
        `one of your competitors instead. That's not an opinion -- it's what these numbers mean.`,
    };
  }

  if (score <= 65) {
    return {
      headline: 'Your website has real problems that are quietly losing you business.',
      narrative:
        `Your site scored ${score} out of 100 overall -- below where it needs to be to compete well online. ` +
        `The weakest spots are ${weakestStr}. ` +
        `Nothing here is broken beyond repair, but these gaps are measurably shrinking the number of ` +
        `people who turn into customers.`,
    };
  }

  if (score <= 85) {
    return {
      headline: 'You have a good foundation, with clear room to grow.',
      narrative:
        `Your site scored ${score} out of 100 overall -- above average, with a few specific areas holding it back. ` +
        `The best opportunities right now are in ${weakestStr}. ` +
        `Closing those gaps would meaningfully increase how many visitors turn into customers.`,
    };
  }

  return {
    headline: 'Your website is performing at a high level.',
    narrative:
      `Your site scored ${score} out of 100 overall -- strong across nearly every area we checked. ` +
      `Even your lower-scoring areas -- ${weakestStr} -- are still solid. ` +
      `Keeping this up will help you stay ahead of competitors as they catch up.`,
  };
}
