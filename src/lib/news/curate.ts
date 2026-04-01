import Anthropic from "@anthropic-ai/sdk";
import type { RSSItem } from "./rss";

export type CuratedStory = {
  title: string;
  url: string;
  source_name: string;
  summary: string;
  published_at: string | null;
  relevance_score: number;
};

export async function curateStories(
  items: RSSItem[],
  topicName: string,
  anthropicApiKey: string,
  userContext?: string | null
): Promise<CuratedStory[]> {
  if (items.length === 0) return [];

  const client = new Anthropic({ apiKey: anthropicApiKey });

  const articleList = items
    .slice(0, 30) // Cap input to avoid token overflow
    .map((item, i) => `${i + 1}. "${item.title}" — ${item.source_name}\n   URL: ${item.url}\n   ${item.snippet}`)
    .join("\n\n");

  const userContextBlock = userContext
    ? `\nUser context (use this to judge relevance):\n${userContext}\n`
    : "";

  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    system: `You are a news curator for a busy professional. Pick the 3-5 most important/interesting stories from the list below for the topic "${topicName}".
${userContextBlock}
For each story, write a ONE-LINE summary (under 120 chars) that explains why it matters — not just what happened. Be specific and opinionated.

Score each story's relevance from 0.0 to 1.0 based on how useful/actionable it is for someone working in this space.

Return ONLY valid JSON, no markdown:
[
  {
    "index": 1,
    "summary": "Why this matters in one line",
    "relevance_score": 0.9
  }
]

Rules:
- Pick 3-5 stories max
- Prefer breaking news, product launches, and actionable insights over opinion pieces
- Skip duplicates (same story from different sources)
- If fewer than 3 stories are genuinely relevant, return fewer`,
    messages: [{ role: "user", content: articleList }],
  });

  const responseText = message.content[0].type === "text" ? message.content[0].text : "";

  let parsed: Array<{ index: number; summary: string; relevance_score: number }>;
  try {
    const jsonStr = responseText.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    parsed = JSON.parse(jsonStr);
  } catch {
    return [];
  }

  return parsed
    .map((p) => {
      const item = items[p.index - 1];
      if (!item) return null;
      return {
        title: item.title,
        url: item.url,
        source_name: item.source_name,
        summary: p.summary,
        published_at: item.published_at,
        relevance_score: p.relevance_score,
      };
    })
    .filter((s): s is CuratedStory => s !== null);
}
