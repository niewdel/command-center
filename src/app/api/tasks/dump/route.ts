import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();
    if (!text?.trim()) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Get user ID and workspaces in parallel
    const [{ data: users }, { data: workspaces }] = await Promise.all([
      supabase.auth.admin.listUsers(),
      supabase
        .from("workspaces")
        .select("id, name, slug, description, type")
        .order("position", { ascending: true }),
    ]);

    const userId = users?.users?.[0]?.id;
    if (!userId) {
      return NextResponse.json({ error: "No user found" }, { status: 500 });
    }

    const workspaceList = workspaces || [];
    const workspaceContext = workspaceList
      .map((w) => `- "${w.name}" (id: ${w.id}, type: ${w.type})${w.description ? ` — ${w.description}` : ""}`)
      .join("\n");

    // Use Claude to analyze the task
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY not configured" },
        { status: 500 }
      );
    }

    const client = new Anthropic({ apiKey: anthropicKey });

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: `You are a task processing assistant for Justin Ledwein, who runs Niewdel (AI & Automation consulting) and is Head of Client Relations at Sandler by i10 Solutions.

Your job: Take a raw task dump and return structured JSON. Be smart about which workspace it belongs to based on the task content.

Available workspaces:
${workspaceContext}

If no workspace clearly fits, use the first workspace in the list as default.

Return ONLY valid JSON in this exact format, nothing else:
{
  "title": "Clean, actionable task title (imperative form, under 80 chars)",
  "workspace_id": "uuid of the best-matching workspace",
  "workspace_name": "name of the matched workspace (for display)",
  "priority": "none" | "low" | "medium" | "high",
  "description": "2-3 sentence summary of what this task involves",
  "research": "Helpful context, tips, tools, or approaches for this task. Be specific and actionable. Include relevant links, tool names, or techniques that would give Justin an advantage. If this involves a specific tool or platform, explain the key steps. Keep it concise but genuinely useful — 3-6 bullet points max.",
  "estimated_minutes": number or null
}

Rules:
- Priority: "high" = urgent/time-sensitive/revenue-impacting, "medium" = important but not urgent, "low" = nice-to-have, "none" = unknown
- The research section is the most valuable part. Think about what Justin would actually need to know to crush this task.
- If the task mentions a specific tool/service, include real setup steps or gotchas.
- Estimated minutes should be realistic for someone with Justin's expertise level.`,
      messages: [
        {
          role: "user",
          content: text.trim(),
        },
      ],
    });

    const responseText =
      message.content[0].type === "text" ? message.content[0].text : "";

    // Parse the JSON response
    let parsed;
    try {
      // Handle potential markdown code blocks in response
      const jsonStr = responseText.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      parsed = JSON.parse(jsonStr);
    } catch {
      return NextResponse.json(
        { error: "Failed to parse AI response", raw: responseText },
        { status: 500 }
      );
    }

    // Build the description with research included
    const fullDescription = [
      parsed.description,
      "",
      "---",
      "",
      "**AI Research & Tips:**",
      parsed.research,
    ].join("\n");

    // Create the task
    const { data: task, error } = await supabase
      .from("tasks")
      .insert({
        workspace_id: parsed.workspace_id,
        title: parsed.title,
        description: fullDescription,
        priority: parsed.priority || "none",
        status: "todo",
        source: "ai",
        estimated_minutes: parsed.estimated_minutes || null,
      })
      .select("id, title, workspace_id, priority, description, estimated_minutes")
      .single();

    if (error) {
      console.error("Failed to create task:", error);
      return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      task,
      workspace_name: parsed.workspace_name,
      research: parsed.research,
    });
  } catch (error) {
    console.error("Dump error:", error);
    return NextResponse.json(
      { error: "Failed to process task" },
      { status: 500 }
    );
  }
}
