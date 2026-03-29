import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSystemPrompt, AI_PARSE_TOOLS } from "@/lib/ai/prompts";
import type { AiParseResult } from "@/types/database";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { input, context } = await request.json();

    if (!input || typeof input !== "string") {
      return NextResponse.json({ error: "Input is required" }, { status: 400 });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY not configured" },
        { status: 500 }
      );
    }

    const systemPrompt = getSystemPrompt({
      currentDate:
        context?.currentDate || new Date().toISOString(),
      timezone: context?.timezone || "America/New_York",
      workspaces: context?.workspaces || [
        { name: "Niewdel", slug: "niewdel", type: "business" },
        { name: "i10 Solutions", slug: "i10", type: "business" },
        { name: "Personal", slug: "personal", type: "personal" },
      ],
    });

    const startTime = Date.now();

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: systemPrompt,
      tools: AI_PARSE_TOOLS,
      tool_choice: { type: "tool", name: "parse_command" },
      messages: [
        {
          role: "user",
          content: input,
        },
      ],
    });

    const duration = Date.now() - startTime;

    // Extract the tool use result
    const toolUse = response.content.find(
      (block) => block.type === "tool_use"
    );

    if (!toolUse || toolUse.type !== "tool_use") {
      return NextResponse.json(
        { error: "Failed to parse command" },
        { status: 500 }
      );
    }

    const parsed = toolUse.input as AiParseResult;

    return NextResponse.json({
      ...parsed,
      duration_ms: duration,
    });
  } catch (error) {
    console.error("AI parse error:", error);
    return NextResponse.json(
      { error: "Failed to parse command" },
      { status: 500 }
    );
  }
}
