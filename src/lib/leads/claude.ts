import Anthropic from "@anthropic-ai/sdk";
import { RESEARCH_PROMPT, OUTREACH_PROMPT, fillPrompt } from "./prompts";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY");
    client = new Anthropic({ apiKey });
  }
  return client;
}

export async function generateResearch(
  companyName: string,
  domain: string | null,
  industry: string | null,
  location: string | null,
  headcount: number | null,
  revenueRange: string | null
): Promise<{ profile: Record<string, unknown>; summary: string }> {
  const prompt = fillPrompt(RESEARCH_PROMPT, {
    company_name: companyName,
    domain: domain ?? "unknown",
    industry: industry ?? "unknown",
    location: location ?? "unknown",
    headcount: headcount?.toString() ?? "unknown",
    revenue_range: revenueRange ?? "unknown",
  });

  const response = await getClient().messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  return parseResearchResponse(text);
}

function parseResearchResponse(text: string): {
  profile: Record<string, unknown>;
  summary: string;
} {
  const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
  if (!jsonMatch) {
    try {
      const parsed = JSON.parse(text);
      return { profile: parsed.profile ?? parsed, summary: parsed.summary ?? "" };
    } catch {
      return { profile: { raw: text }, summary: text.slice(0, 500) };
    }
  }
  const profile = JSON.parse(jsonMatch[1]);
  const afterJson = text.slice(text.indexOf("```", jsonMatch.index! + 3) + 3).trim();
  const summary = afterJson || (profile.summary as string) || "";
  return { profile, summary };
}

export async function generateOutreach(
  researchSummary: string,
  contactName: string,
  contactTitle: string,
  outreachConfig: Record<string, unknown>
): Promise<Array<{ step: number; subject: string; body: string }>> {
  const prompt = fillPrompt(OUTREACH_PROMPT, {
    research_summary: researchSummary,
    contact_name: contactName,
    contact_title: contactTitle,
    sequence_length: String(outreachConfig.sequence_length ?? 3),
    tone: String(outreachConfig.tone ?? "sandler-pain"),
    offer_angle: String(outreachConfig.offer_angle ?? ""),
    stress_test: String(outreachConfig.stress_test ?? ""),
    physical_address: String(outreachConfig.physical_address ?? ""),
    opt_out_text: String(outreachConfig.opt_out_text ?? ""),
  });

  const response = await getClient().messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  return parseOutreachResponse(text);
}

function parseOutreachResponse(
  text: string
): Array<{ step: number; subject: string; body: string }> {
  const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    const parsed = JSON.parse(jsonMatch[1]);
    if (Array.isArray(parsed)) return parsed;
    if (parsed.emails && Array.isArray(parsed.emails)) return parsed.emails;
  }
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed;
    if (parsed.emails && Array.isArray(parsed.emails)) return parsed.emails;
  } catch {
    // fallthrough
  }
  throw new Error("Failed to parse outreach response as JSON");
}
