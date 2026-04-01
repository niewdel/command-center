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

    if (parsed.intent === "create_event" && parsed.event) {
      // Look up workspace ID from slug
      let workspace_id: string | null = null;
      if (parsed.event.workspace_slug) {
        const { data: workspace } = await supabase
          .from("workspaces")
          .select("id")
          .eq("slug", parsed.event.workspace_slug)
          .single();
        workspace_id = workspace?.id ?? null;
      }

      const { data: event, error } = await supabase
        .from("calendar_events")
        .insert({
          user_id: userId,
          workspace_id,
          title: parsed.event.title,
          start_time: parsed.event.start_time,
          end_time: parsed.event.end_time,
          location: parsed.event.location || null,
          all_day: parsed.event.all_day || false,
          attendees: parsed.event.attendees
            ? parsed.event.attendees.map((a) => ({ email: "", name: a }))
            : [],
          meeting_provider: parsed.event.meeting_type || null,
          source: "local",
        })
        .select("id")
        .single();

      if (error) throw error;

      entity_type = "event";
      entity_id = event.id;
      action_taken = `Created event: ${parsed.event.title}`;
    } else if (parsed.intent === "create_task" && parsed.task) {
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
    } else if (parsed.intent === "reschedule" && parsed.reschedule) {
      // Find the event by title match
      const { data: events } = await supabase
        .from("calendar_events")
        .select("id, title")
        .eq("user_id", userId)
        .ilike("title", `%${parsed.reschedule.search_title}%`)
        .limit(1);

      if (events && events.length > 0) {
        const { error } = await supabase
          .from("calendar_events")
          .update({
            start_time: parsed.reschedule.new_start_time,
            end_time: parsed.reschedule.new_end_time,
            updated_at: new Date().toISOString(),
          })
          .eq("id", events[0].id);

        if (error) throw error;

        entity_type = "event";
        entity_id = events[0].id;
        action_taken = `Rescheduled: ${events[0].title}`;
      } else {
        action_taken = "No matching event found to reschedule";
      }
    } else if (parsed.intent === "cancel" && parsed.cancel) {
      if (parsed.cancel.entity_type === "event") {
        const { data: events } = await supabase
          .from("calendar_events")
          .select("id, title, start_time")
          .eq("user_id", userId)
          .neq("status", "cancelled")
          .ilike("title", `%${parsed.cancel.search_title}%`)
          .order("start_time", { ascending: true })
          .limit(5);

        if (events && events.length > 0) {
          // Pick the most upcoming event
          const now = new Date().toISOString();
          const upcoming = events.find((e) => e.start_time >= now) || events[0];

          const { error } = await supabase
            .from("calendar_events")
            .update({ status: "cancelled", updated_at: new Date().toISOString() })
            .eq("id", upcoming.id);

          if (error) throw error;

          entity_type = "event";
          entity_id = upcoming.id;
          action_taken = `Cancelled event: ${upcoming.title}`;
        } else {
          action_taken = "No matching event found to cancel";
        }
      } else {
        // Cancel a task → mark as done
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
      const { data: events } = await supabase
        .from("calendar_events")
        .select("id, title, start_time, end_time, location, all_day")
        .eq("user_id", userId)
        .neq("status", "cancelled")
        .gte("start_time", parsed.query.date_range_start)
        .lte("start_time", parsed.query.date_range_end)
        .order("start_time", { ascending: true })
        .limit(20);

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

      action_taken = `Found ${events?.length || 0} events and ${tasks?.length || 0} tasks`;

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
        events: events || [],
        tasks: tasks || [],
      });
    } else if (parsed.intent === "find_free_time" && parsed.query) {
      const { data: events } = await supabase
        .from("calendar_events")
        .select("start_time, end_time")
        .eq("user_id", userId)
        .neq("status", "cancelled")
        .gte("start_time", parsed.query.date_range_start)
        .lte("start_time", parsed.query.date_range_end)
        .order("start_time", { ascending: true });

      // Compute free slots between 9am and 6pm
      const rangeStart = new Date(parsed.query.date_range_start);
      const rangeEnd = new Date(parsed.query.date_range_end);
      const free_slots: { start: string; end: string; duration_minutes: number }[] = [];

      // Iterate day by day
      const current = new Date(rangeStart);
      current.setHours(0, 0, 0, 0);
      const endDay = new Date(rangeEnd);
      endDay.setHours(23, 59, 59, 999);

      while (current <= endDay) {
        const dayStart = new Date(current);
        dayStart.setHours(9, 0, 0, 0);
        const dayEnd = new Date(current);
        dayEnd.setHours(18, 0, 0, 0);

        // Get events for this day
        const dayEvents = (events || [])
          .filter((e) => {
            const eStart = new Date(e.start_time);
            return eStart >= dayStart && eStart < dayEnd;
          })
          .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

        let slotStart = dayStart;
        for (const ev of dayEvents) {
          const evStart = new Date(ev.start_time);
          if (evStart > slotStart) {
            const durationMin = Math.round((evStart.getTime() - slotStart.getTime()) / 60000);
            if (durationMin >= 30) {
              free_slots.push({
                start: slotStart.toISOString(),
                end: evStart.toISOString(),
                duration_minutes: durationMin,
              });
            }
          }
          const evEnd = new Date(ev.end_time);
          if (evEnd > slotStart) {
            slotStart = evEnd;
          }
        }
        // Remaining time until end of day
        if (slotStart < dayEnd) {
          const durationMin = Math.round((dayEnd.getTime() - slotStart.getTime()) / 60000);
          if (durationMin >= 30) {
            free_slots.push({
              start: slotStart.toISOString(),
              end: dayEnd.toISOString(),
              duration_minutes: durationMin,
            });
          }
        }

        current.setDate(current.getDate() + 1);
      }

      action_taken = `Found ${free_slots.length} free slots`;

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
        free_slots,
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
