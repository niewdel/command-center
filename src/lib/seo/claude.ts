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

// We pass score deltas + resolved counts only, never the full crawl JSON or
// the open-issue list. Keeps cost bounded (~$0.001 per check) and keeps the
// client-facing summary from ever surfacing what's broken.

const SYSTEM = `You are writing a short status note FROM the team at Niewdel TO our client, summarizing the SEO and website work we do for them each period. Niewdel is full-service: we build and maintain the client's website AND run their SEO, all in-house. Write as "we" (Niewdel), speaking to the client about their site.

Voice: confident, plain-spoken, professional. Short sentences. Lead with how the site is performing. Make it clear Niewdel is actively working on their behalf and keeping the site healthy and ranking. This goes straight into a client-facing report, so it must read like it came from our team.

Cover, in 2-3 sentences:
- How the site is performing and holding up (use the scores and any gains as positive signals; strong, stable scores are worth affirming).
- What we stayed on top of this period (work we handled, upkeep we ran, things we kept clean).

HARD RULES (zero exceptions):
- Never tell the client what is broken, what needs fixing, or what they should do. No to-do lists, no "you should", no "focus on", no recommendations aimed at the client.
- Never mention a third party, "your developer", or "your team". Niewdel owns all of the work.
- Never use the words "issue", "problem", "concern", "error", "failing", or "broken". Frame everything around progress and upkeep.
- No jargon, no buzzwords, no AI filler ("happy to", "let's dive in", "certainly").
- Never use em dashes or en dashes. Use periods, commas, colons, or parentheses.
- No lists, bullets, headers, or markdown. Plain prose only.`;

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
      `Work we completed this period: ${input.diff.resolved_issues_count} item(s) cleaned up and resolved.`,
      `Pages we updated or added this period: ${input.diff.pages_added + input.diff.pages_changed}.`
    );
  }

  userParts.push(
    "",
    "Write the 2-3 sentence note from Niewdel to the client now. Lead with how the site is performing, then what we stayed on top of this period. Do not mention anything that is broken and do not tell the client to do anything."
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

// ---------------------------------------------------------------------------
// Monthly email summary — client-facing prose covering scores + issues +
// traffic in 3-5 sentences. Used as the body of the monthly report email
// instead of a boring bullet list.
// ---------------------------------------------------------------------------

const EMAIL_SUMMARY_SYSTEM = `You are writing a brief monthly email summary for an SEO client. You are writing on behalf of Niewdel (the agency), and Niewdel is full-service: Niewdel both builds/maintains the client's website AND runs their SEO. The client has no separate development team — Niewdel handles every technical change in-house.

Address the reader directly in plain English. No jargon. Cover three things in 3-5 sentences total:
1. How the site's SEO health moved this month (scores up/down, what changed)
2. What was found or fixed (new issues, resolved issues)
3. Traffic context if provided (sessions, organic search, notable shifts)

End with a single short recommendation or affirmation framed as something Niewdel/"we" are doing or about to do on the client's behalf (e.g. "We're shipping the title-tag rewrite this week"). Be specific with numbers where they help. If traffic data is all zeros, briefly note that data collection just started or is still ramping up. Never use lists, bullets, headers, or markdown. Return plain prose only.

CRITICAL CONTENT RULE: Never tell the client to "talk to your developer", "reach out to your dev team", "have your engineer fix X", "ask IT to update Y", "coordinate with your tech team", or any phrasing that implies a third party will do the work. Every technical recommendation must read as something Niewdel is owning. This rule has zero exceptions.

CRITICAL FORMATTING RULE: Never use em dashes or en dashes anywhere in your output. Use periods, commas, colons, semicolons, parentheses, or restructured sentences instead. This rule has zero exceptions.

CRITICAL OPENING RULE: Do NOT start with a greeting. No "Hi Kyle,", "Hey Kyle,", "Hello,", or any salutation. The email template already renders "Hi {name}," above your prose, so a greeting from you produces a duplicate. Start directly with the period summary sentence (e.g. "May was a steady month for hdgrading.com..."). This rule has zero exceptions.`;

interface EmailSummaryInput {
  domain: string;
  client_name: string;
  contact_name: string | null;
  period_label: string;
  scores: {
    technical: number | null;
    onpage: number | null;
    lighthouse_mobile: number | null;
    lighthouse_desktop: number | null;
  };
  deltas: {
    technical: number | null;
    onpage: number | null;
    lighthouse_mobile: number | null;
    lighthouse_desktop: number | null;
  };
  new_issue_count: number;
  resolved_issue_count: number;
  top_critical_issues: string[];
  traffic: {
    sessions: number;
    organic_sessions: number;
    users: number;
    sessions_delta: number | null;
    organic_sessions_delta: number | null;
  } | null;
}

export async function generateEmailSummary(
  input: EmailSummaryInput
): Promise<string> {
  const fmt = (n: number | null) =>
    n == null ? "n/a" : `${n > 0 ? "+" : ""}${n}`;

  const userParts: string[] = [
    `Client: ${input.client_name} (${input.domain})`,
    input.contact_name
      ? `Recipient: ${input.contact_name}`
      : "Recipient: (no name)",
    `Period: ${input.period_label}`,
    "",
    "SEO scores (out of 100, change vs prior period):",
    `- Technical: ${input.scores.technical ?? "n/a"} (${fmt(input.deltas.technical)})`,
    `- On-page: ${input.scores.onpage ?? "n/a"} (${fmt(input.deltas.onpage)})`,
    `- Lighthouse mobile: ${input.scores.lighthouse_mobile ?? "n/a"} (${fmt(input.deltas.lighthouse_mobile)})`,
    `- Lighthouse desktop: ${input.scores.lighthouse_desktop ?? "n/a"} (${fmt(input.deltas.lighthouse_desktop)})`,
    "",
    `Issue movement: ${input.new_issue_count} new, ${input.resolved_issue_count} resolved this month.`,
  ];

  if (input.top_critical_issues.length > 0) {
    userParts.push("Top critical/high issues:");
    for (const t of input.top_critical_issues.slice(0, 3))
      userParts.push(`- ${t}`);
  }

  if (input.traffic) {
    userParts.push(
      "",
      "Traffic (last 7 days vs prior 7 days):",
      `- Sessions: ${input.traffic.sessions} (${fmt(input.traffic.sessions_delta)})`,
      `- Organic sessions: ${input.traffic.organic_sessions} (${fmt(input.traffic.organic_sessions_delta)})`,
      `- Users: ${input.traffic.users}`
    );
    if (input.traffic.sessions === 0) {
      userParts.push(
        "Note: traffic numbers are zero, likely because GA4 tracking was just installed or no traffic has flowed yet this period."
      );
    }
  } else {
    userParts.push("", "Traffic: not yet connected for this client.");
  }

  userParts.push(
    "",
    "Write a 3-5 sentence email body. Open with a one-sentence summary of the period. Then briefly cover what was fixed or flagged. Then mention traffic if meaningful. Close with a single concrete recommendation. Plain prose only."
  );

  const client = getClient();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 400,
    system: [
      {
        type: "text",
        text: EMAIL_SUMMARY_SYSTEM,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userParts.join("\n") }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  const raw = textBlock && "text" in textBlock ? textBlock.text.trim() : "";
  return stripDashes(stripLeadingGreeting(raw));
}

// Defensive: the email template renders "Hi {name}," above this prose, so any
// greeting Claude emits creates a visible duplicate (see kharrison@hdgrading
// May 2026 send). The system prompt forbids it; this strips it if it slips
// through anyway.
function stripLeadingGreeting(s: string): string {
  return s
    .replace(/^\s*(hi|hey|hello)(\s+[^,.\n]+)?[,.]?\s+/i, "")
    .trimStart();
}
