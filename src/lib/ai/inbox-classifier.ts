import Anthropic from "@anthropic-ai/sdk";

type ClassificationInput = {
  id: string;
  subject: string;
  snippet: string;
  senderEmail: string;
};

type ClassificationResult = {
  id: string;
  category: string;
  confidence: number;
  summary: string;
};

export async function classifyInboxItems(
  items: ClassificationInput[],
  anthropicApiKey: string
): Promise<ClassificationResult[]> {
  if (items.length === 0) return [];

  const client = new Anthropic({ apiKey: anthropicApiKey });

  const emailList = items
    .map(
      (item, i) =>
        `[${i}] ID: ${item.id}\nFrom: ${item.senderEmail}\nSubject: ${item.subject}\nPreview: ${item.snippet}`
    )
    .join("\n\n");

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    system: `You are an email classifier. For each email, determine:
1. category: one of "action_required", "needs_response", "informational", "promotional", "trash"
2. confidence: 0.0 to 1.0
3. summary: one concise sentence describing what the email is about

Categories:
- action_required: needs the user to do something (sign a document, complete a task, approve something, pay a bill)
- needs_response: expects a reply but no specific action beyond responding (questions, discussion threads, meeting requests)
- informational: FYI only, no response needed (receipts, confirmations, status updates, newsletters with useful content)
- promotional: marketing, sales offers, product announcements, social media notifications
- trash: spam, phishing, irrelevant bulk mail

Respond with ONLY a JSON array. No markdown, no code fences, no explanation.
Each element: {"id": "...", "category": "...", "confidence": 0.0, "summary": "..."}`,
    messages: [
      {
        role: "user",
        content: `Classify these emails:\n\n${emailList}`,
      },
    ],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from classifier");
  }

  const parsed: ClassificationResult[] = JSON.parse(textBlock.text);

  // Validate each result has required fields
  return parsed.map((r) => ({
    id: r.id,
    category: r.category,
    confidence: Math.min(1, Math.max(0, r.confidence)),
    summary: r.summary,
  }));
}
