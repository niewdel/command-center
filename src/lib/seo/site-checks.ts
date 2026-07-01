import type { SeoIssueDraft } from "./types";
import { issueFingerprint } from "./fingerprint";

// Per Anthropic + ChatGPT + Perplexity + Google docs (and the ai-seo skill).
// Each platform has its own crawler; blocking any of them prevents that
// platform from citing you in AI answers.
export const AI_BOTS = [
  { name: "GPTBot", platform: "ChatGPT (training)" },
  { name: "ChatGPT-User", platform: "ChatGPT (live search)" },
  { name: "PerplexityBot", platform: "Perplexity" },
  { name: "ClaudeBot", platform: "Claude" },
  { name: "anthropic-ai", platform: "Claude" },
  { name: "Google-Extended", platform: "Gemini + Google AI Overviews" },
  { name: "OAI-SearchBot", platform: "ChatGPT search" },
];

export interface RobotsParseResult {
  text: string;
  hasSitemap: boolean;
  blockedAiBots: string[];          // user-agent names that are disallowed (any path) for "/"
  catchAllDisallow: boolean;        // a "User-agent: * \n Disallow: /" globally blocks everything
}

async function fetchRobots(rootOrigin: string): Promise<RobotsParseResult | null> {
  try {
    const res = await fetch(`${rootOrigin}/robots.txt`, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; NiewdelSeoAgent/1.0)" },
    });
    if (!res.ok) return null;
    const text = await res.text();
    return parseRobots(text);
  } catch {
    return null;
  }
}

export function parseRobots(text: string): RobotsParseResult {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  let hasSitemap = false;
  let catchAllDisallow = false;
  const blockedAiBots: string[] = [];

  // Walk the file in groups: each "User-agent" starts a group, the disallows
  // until the next User-agent (or EOF) belong to that group.
  let currentAgents: string[] = [];
  let collectingAgents = true;
  const groupDisallows = new Map<string, string[]>(); // agent → disallow paths

  for (const line of lines) {
    if (line.startsWith("#")) continue;
    if (line.toLowerCase().startsWith("sitemap:")) {
      hasSitemap = true;
      continue;
    }
    if (line.toLowerCase().startsWith("user-agent:")) {
      const ua = line.slice("user-agent:".length).trim();
      if (!collectingAgents) {
        currentAgents = [];
        collectingAgents = true;
      }
      currentAgents.push(ua);
      if (!groupDisallows.has(ua)) groupDisallows.set(ua, []);
      continue;
    }
    if (line.toLowerCase().startsWith("disallow:")) {
      collectingAgents = false;
      const path = line.slice("disallow:".length).trim();
      for (const ua of currentAgents) groupDisallows.get(ua)?.push(path);
    }
  }

  // catch-all disallow
  const wildcardRules = groupDisallows.get("*") ?? [];
  if (wildcardRules.includes("/")) catchAllDisallow = true;

  // AI bot blocks: bot is blocked if it has its own group disallowing "/",
  // OR if catch-all blocks "/" and the bot has no overriding allow.
  for (const bot of AI_BOTS) {
    const ownRules = groupDisallows.get(bot.name);
    if (ownRules && ownRules.includes("/")) {
      blockedAiBots.push(bot.name);
    } else if (catchAllDisallow && !ownRules) {
      blockedAiBots.push(bot.name);
    }
  }

  return { text, hasSitemap, blockedAiBots, catchAllDisallow };
}

export async function checkUrlExists(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      headers: { "user-agent": "Mozilla/5.0 (compatible; NiewdelSeoAgent/1.0)" },
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Run site-level checks that don't require crawling pages: robots.txt
 * health, AI bot access, /llms.txt, /pricing.md presence.
 */
export async function runSiteLevelChecks(
  rootUrl: string
): Promise<SeoIssueDraft[]> {
  const issues: SeoIssueDraft[] = [];
  const origin = (() => {
    try {
      return new URL(rootUrl).origin;
    } catch {
      return rootUrl;
    }
  })();

  // ---- robots.txt ----
  const robots = await fetchRobots(origin);
  if (!robots) {
    issues.push({
      fingerprint: issueFingerprint("technical", "no_robots_txt", null),
      severity: "medium",
      category: "technical",
      sub_type: "no_robots_txt",
      page_url: null,
      title: "robots.txt is missing or unreachable",
      description:
        "Search engines and AI crawlers look for /robots.txt to learn what's crawlable. Without it, they fall back to crawling everything (rarely a real problem) but it's a missed opportunity to point them at your sitemap.",
      recommendation:
        "Create a /robots.txt with at minimum a `Sitemap: https://yourdomain.com/sitemap.xml` line and `User-agent: *` + `Allow: /`.",
    });
  } else {
    if (!robots.hasSitemap) {
      issues.push({
        fingerprint: issueFingerprint("technical", "robots_no_sitemap", null),
        severity: "low",
        category: "technical",
        sub_type: "robots_no_sitemap",
        page_url: null,
        title: "robots.txt does not reference a sitemap",
        description:
          "Adding a `Sitemap:` directive helps Google + Bing discover your sitemap quickly without you submitting it manually.",
        recommendation:
          "Add `Sitemap: https://yourdomain.com/sitemap.xml` to /robots.txt.",
      });
    }
    if (robots.catchAllDisallow) {
      issues.push({
        fingerprint: issueFingerprint("technical", "robots_blocks_all", null),
        severity: "critical",
        category: "technical",
        sub_type: "robots_blocks_all",
        page_url: null,
        title: "robots.txt is blocking the entire site",
        description:
          "`User-agent: *` with `Disallow: /` tells every crawler to ignore the site. Search engines and AI assistants cannot index or cite anything.",
        recommendation:
          "Remove the `Disallow: /` line under `User-agent: *`. If you need to block specific paths, list them individually.",
      });
    }
    // AI bot blocks
    for (const blocked of robots.blockedAiBots) {
      const meta = AI_BOTS.find((b) => b.name === blocked);
      issues.push({
        fingerprint: issueFingerprint("ai_search", `bot_blocked_${blocked}`, null),
        severity: "medium",
        category: "ai_search",
        sub_type: `bot_blocked_${blocked}`,
        page_url: null,
        title: `${meta?.platform ?? blocked} is blocked from crawling this site`,
        description: `The bot \`${blocked}\` is disallowed in /robots.txt, which means ${meta?.platform ?? blocked} cannot read this site's content to cite it in AI answers.`,
        recommendation: `If you want to be cited by ${meta?.platform ?? blocked}, remove the \`Disallow\` rule for \`User-agent: ${blocked}\`. Note: this may affect AI training-data usage; weigh that against AI-search visibility.`,
      });
    }
  }

  // ---- /llms.txt ----
  const hasLlmsTxt = await checkUrlExists(`${origin}/llms.txt`);
  if (!hasLlmsTxt) {
    issues.push({
      fingerprint: issueFingerprint("ai_search", "no_llms_txt", null),
      severity: "low",
      category: "ai_search",
      sub_type: "no_llms_txt",
      page_url: null,
      title: "No /llms.txt file present",
      description:
        "/llms.txt is an emerging convention (llmstxt.org) for giving AI systems a quick, parseable overview of what your site is, who it's for, and where the key pages are.",
      recommendation:
        "Create /llms.txt with a short markdown summary of the site, your value prop, and links to key pages (homepage, services, pricing if applicable, contact).",
    });
  }

  // ---- /pricing.md ----
  // Only relevant for businesses with pricing visible on their site. Skip for
  // pure-services sites where this would be noise — but for the local-service
  // clients in this app, signaling explicit service tiers helps AI agents.
  // Lower severity since not all sites need it.
  const hasPricingMd = await checkUrlExists(`${origin}/pricing.md`);
  const hasPricingTxt = await checkUrlExists(`${origin}/pricing.txt`);
  if (!hasPricingMd && !hasPricingTxt) {
    issues.push({
      fingerprint: issueFingerprint("ai_search", "no_pricing_md", null),
      severity: "low",
      category: "ai_search",
      sub_type: "no_pricing_md",
      page_url: null,
      title: "No /pricing.md (or /pricing.txt) file for AI agents",
      description:
        "AI agents that compare service providers on behalf of buyers can't reliably parse JS-rendered pricing pages. A markdown pricing file gives them clean structured data.",
      recommendation:
        "Add /pricing.md with service tiers, prices, and what's included at each level. Keep it short and updated.",
    });
  }

  return issues;
}
