import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { AiParseResult } from "@/types/database";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const { data: users } = await supabase.auth.admin.listUsers();
    const userId = users?.users?.[0]?.id;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { parsed, source = "command_bar" } = (await request.json()) as {
      parsed: AiParseResult & { duration_ms?: number };
      source?: string;
    };

    if (!parsed || !parsed.intent) {
      return NextResponse.json(
        { error: "Parsed result is required" },
        { status: 400 }
      );
    }

    let entity_type: string | null = null;
    let entity_id: string | null = null;
    let action_taken: string | null = null;

    if (parsed.intent === "create_task" && parsed.task) {
      // Look up workspace ID from slug
      let workspace_id: string | null = null;
      if (parsed.task.workspace_slug) {
        const { data: workspace } = await supabase
          .from("workspaces")
          .select("id")
          .eq("slug", parsed.task.workspace_slug)
          .single();
        workspace_id = workspace?.id ?? null;
      }

      // Default to first workspace if none specified
      if (!workspace_id) {
        const { data: workspaces } = await supabase
          .from("workspaces")
          .select("id")
          .limit(1);
        workspace_id = workspaces?.[0]?.id ?? null;
      }

      const { data: task, error } = await supabase
        .from("tasks")
        .insert({
          workspace_id,
          title: parsed.task.title,
          due_date: parsed.task.due_date || null,
          priority: parsed.task.priority || "none",
          estimated_minutes: parsed.task.estimated_minutes || null,
          source: "ai",
        })
        .select("id")
        .single();

      if (error) throw error;

      entity_type = "task";
      entity_id = task.id;
      action_taken = `Created task: ${parsed.task.title}`;
    } else if (parsed.intent === "cancel" && parsed.cancel) {
      {
        const { data: tasks } = await supabase
          .from("tasks")
          .select("id, title, due_date")
          .neq("status", "done")
          .ilike("title", `%${parsed.cancel.search_title}%`)
          .order("due_date", { ascending: true, nullsFirst: false })
          .limit(5);

        if (tasks && tasks.length > 0) {
          const { error } = await supabase
            .from("tasks")
            .update({ status: "done", completed_at: new Date().toISOString() })
            .eq("id", tasks[0].id);

          if (error) throw error;

          entity_type = "task";
          entity_id = tasks[0].id;
          action_taken = `Completed task: ${tasks[0].title}`;
        } else {
          action_taken = "No matching task found to cancel";
        }
      }
    } else if (parsed.intent === "query_schedule" && parsed.query) {
      const { data: tasks } = await supabase
        .from("tasks")
        .select("id, title, due_date, planned_date, priority, status")
        .neq("status", "done")
        .or(
          `due_date.gte.${parsed.query.date_range_start},planned_date.gte.${parsed.query.date_range_start}`
        )
        .or(
          `due_date.lte.${parsed.query.date_range_end},planned_date.lte.${parsed.query.date_range_end}`
        )
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(20);

      action_taken = `Found ${tasks?.length || 0} tasks`;

      // Log + return with data
      await supabase.from("ai_command_log").insert({
        user_id: userId,
        raw_input: parsed.display_text,
        parsed_intent: parsed.intent,
        parsed_data: parsed as unknown as Record<string, unknown>,
        action_taken,
        entity_type: null,
        entity_id: null,
        confidence: parsed.confidence,
        source,
        duration_ms: parsed.duration_ms || null,
      });

      return NextResponse.json({
        success: true,
        entity_type: null,
        entity_id: null,
        action_taken,
        tasks: tasks || [],
      });
    } else {
      action_taken = "Unknown intent — no action taken";
    }

    // Log the command
    await supabase.from("ai_command_log").insert({
      user_id: userId,
      raw_input: parsed.display_text,
      parsed_intent: parsed.intent,
      parsed_data: parsed as unknown as Record<string, unknown>,
      action_taken,
      entity_type,
      entity_id,
      confidence: parsed.confidence,
      source,
      duration_ms: parsed.duration_ms || null,
    });

    return NextResponse.json({
      success: true,
      entity_type,
      entity_id,
      action_taken,
    });
  } catch (error) {
    console.error("AI execute error:", error);
    return NextResponse.json(
      { error: "Failed to execute command" },
      { status: 500 }
    );
  }
}
