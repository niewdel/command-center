import Anthropic from "@anthropic-ai/sdk";
import type { CheckScores } from "./types";
import type { CheckDiff } from "./diff";

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY");
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

const MODEL = "claude-sonnet-4-6";

// Cap the input token budget hard. We pass deltas + counts + top critical
// issues only — never the full crawl JSON. This keeps cost bounded
// (~$0.001 per check) and prevents a giant site from blowing up the prompt.
const MAX_TOP_ISSUES = 5;

const SYSTEM = `You are an SEO analyst writing a 2-3 sentence weekly summary for a solo SEO operator. Write in plain English, no jargon. Be specific about what changed and what to prioritize. If everything is stable, say so plainly. Never recommend more than 1-2 actions. Never use lists or markdown. Return prose only.

CRITICAL FORMATTING RULE: Never use em dashes (—) or en dashes (–) anywhere in your output. Use periods, commas, colons, semicolons, parentheses, or restructured sentences instead. This rule has zero exceptions. If you are tempted to use an em dash, rewrite the sentence as two shorter sentences or use a comma.`;

interface SummaryInput {
  domain: string;
  client_name: string;
  scores: CheckScores;
  diff: CheckDiff;
  top_issues: { severity: string; title: string; page_url: string | null }[];
  is_first_run: boolean;
}

/**
 * Generate a 2-3 sentence summary of this week's SEO check. Token-capped.
 * Uses prompt caching on the system block so repeated calls share the cache
 * (5-min TTL on Anthropic's side).
 */
export async function generateCheckSummary(input: SummaryInput): Promise<string> {
  const top = input.top_issues.slice(0, MAX_TOP_ISSUES);

  const userParts: string[] = [
    `Client: ${input.client_name} (${input.domain})`,
    `Run type: ${input.is_first_run ? "first ever check (no prior week to compare to)" : "weekly comparison vs prior week"}`,
    "",
    "Current scores (out of 100):",
    `- Technical: ${input.scores.technical}`,
    `- On-page: ${input.scores.onpage}`,
    `- Lighthouse mobile: ${input.scores.lighthouse_mobile ?? "n/a"}`,
  ];

  if (!input.is_first_run) {
    const sd = input.diff.score_deltas;
    const fmt = (n: number | null) =>
      n == null ? "n/a" : `${n > 0 ? "+" : ""}${n}`;
    userParts.push(
      "",
      "Score change vs last week:",
      `- Technical: ${fmt(sd.technical)}`,
      `- On-page: ${fmt(sd.onpage)}`,
      `- Lighthouse mobile: ${fmt(sd.lighthouse_mobile)}`,
      "",
      `Issue movement: ${input.diff.new_issues_count} new, ${input.diff.resolved_issues_count} resolved, ${input.diff.unchanged_issues_count} unchanged.`,
      `Page churn: ${input.diff.pages_added} added, ${input.diff.pages_removed} removed, ${input.diff.pages_changed} content-changed.`
    );
  }

  if (top.length > 0) {
    userParts.push("", `Top open issues by severity:`);
    for (const i of top) {
      userParts.push(
        `- [${i.severity}] ${i.title}${i.page_url ? ` (${i.page_url})` : ""}`
      );
    }
  } else {
    userParts.push("", "No open issues found.");
  }

  userParts.push(
    "",
    "Write a 2-3 sentence summary suitable for the operator's dashboard. Lead with the headline (what's the state), then any change worth noting, then a single concrete next action."
  );

  const userMessage = userParts.join("\n");

  const client = getClient();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 220,
    system: [
      {
        type: "text",
        text: SYSTEM,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userMessage }],
  });

  // Extract text from the first content block
  const textBlock = response.content.find((b) => b.type === "text");
  const raw = textBlock && "text" in textBlock ? textBlock.text.trim() : "";
  return stripDashes(raw);
}

// Belt-and-suspenders: even with the SYSTEM prompt forbidding em/en dashes,
// Claude occasionally slips. Replace any that get through with sensible
// fallbacks so the dashboard + PDF + email never show one.
function stripDashes(s: string): string {
  return s
    // em dash with surrounding spaces -> period + space
    .replace(/\s+—\s+/g, ". ")
    // en dash with surrounding spaces -> period + space
    .replace(/\s+–\s+/g, ". ")
    // bare em/en dash with no spaces (e.g. range like "5–10") -> regular hyphen
    .replace(/[—–]/g, "-")
    // collapse any double-period that resulted from the replacement
    .replace(/\.\s+\./g, ".")
    .trim();
}
