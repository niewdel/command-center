import { useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Task } from "@/types/database";
import { parseRecurrenceRule, computeNextOccurrence } from "@/lib/recurrence";

export function useTaskActions(
  tasks: Task[],
  onRefresh: () => void
) {
  const handleToggle = useCallback(
    async (id: string, done: boolean) => {
      const task = tasks.find((t) => t.id === id);

      await supabase
        .from("tasks")
        .update({
          status: done ? "done" : "todo",
          completed_at: done ? new Date().toISOString() : null,
        })
        .eq("id", id);

      // If completing a recurring task, create next occurrence
      if (done && task?.is_recurring && task.recurrence_rule) {
        const rule = parseRecurrenceRule(task.recurrence_rule);
        if (rule) {
          const todayStr = new Date().toISOString().split("T")[0];
          const nextDate = computeNextOccurrence(todayStr, rule);

          await supabase.from("tasks").insert({
            workspace_id: task.workspace_id,
            project_id: task.project_id,
            client_id: task.client_id,
            goal_id: task.goal_id,
            title: task.title,
            description: task.description,
            priority: task.priority,
            estimated_minutes: task.estimated_minutes,
            is_recurring: true,
            recurrence_rule: task.recurrence_rule,
            planned_date: nextDate,
            due_date: nextDate,
            status: "todo",
            source: task.source,
          });
        }
      }

      onRefresh();
    },
    [tasks, onRefresh]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      await supabase.from("tasks").delete().eq("id", id);
      onRefresh();
    },
    [onRefresh]
  );

  const handleEdit = useCallback(
    async (id: string, updates: Partial<Task>) => {
      await supabase.from("tasks").update(updates).eq("id", id);
      onRefresh();
    },
    [onRefresh]
  );

  const handleAdd = useCallback(
    async (taskData: {
      title: string;
      workspace_id: string;
      priority: string;
      due_date: string | null;
      estimated_minutes: number | null;
      planned_date: string | null;
    }) => {
      await supabase.from("tasks").insert({
        ...taskData,
        status: "todo",
        source: "manual",
      });
      onRefresh();
    },
    [onRefresh]
  );

  return { handleToggle, handleDelete, handleEdit, handleAdd };
}
