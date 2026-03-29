"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Task, Workspace } from "@/types/database";
import { TaskItem } from "@/components/tasks/task-item";
import { EditTaskDialog } from "@/components/tasks/edit-task-dialog";
import { cn } from "@/lib/utils";
import { CalendarDays } from "lucide-react";

function getDateStr(offset: number) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().split("T")[0];
}

function formatDayLabel(dateStr: string) {
  const today = getDateStr(0);
  const tomorrow = getDateStr(1);
  if (dateStr === today) return "Today";
  if (dateStr === tomorrow) return "Tomorrow";
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

export default function UpcomingPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const [{ data: t }, { data: w }] = await Promise.all([
      supabase
        .from("tasks")
        .select("*")
        .neq("status", "done")
        .order("position", { ascending: true }),
      supabase.from("workspaces").select("*").order("name"),
    ]);
    setTasks(t || []);
    setWorkspaces(w || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel("upcoming-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  const workspaceMap = Object.fromEntries(workspaces.map((w) => [w.id, w]));

  // Build 7-day view
  const days = Array.from({ length: 7 }, (_, i) => getDateStr(i));
  const today = getDateStr(0);

  // Group tasks by planned_date or due_date
  const tasksByDay = new Map<string, Task[]>();
  const unscheduled: Task[] = [];

  for (const day of days) {
    tasksByDay.set(day, []);
  }

  for (const task of tasks) {
    const taskDate = task.planned_date || task.due_date;
    if (taskDate && tasksByDay.has(taskDate)) {
      tasksByDay.get(taskDate)!.push(task);
    } else if (taskDate && taskDate >= today && taskDate <= days[6]) {
      // Within range but not exact match (shouldn't happen, but safe)
      const closest = days.find((d) => d >= taskDate) || days[6];
      tasksByDay.get(closest)?.push(task);
    } else if (!taskDate) {
      unscheduled.push(task);
    }
    // Tasks beyond 7 days are not shown here
  }

  // Also show overdue
  const overdue = tasks.filter(
    (t) => (t.due_date && t.due_date < today) || (t.planned_date && t.planned_date < today)
  );

  const handleToggle = async (id: string, done: boolean) => {
    await supabase
      .from("tasks")
      .update({
        status: done ? "done" : "todo",
        completed_at: done ? new Date().toISOString() : null,
      })
      .eq("id", id);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("tasks").delete().eq("id", id);
    fetchData();
  };

  const handleEdit = async (id: string, updates: Partial<Task>) => {
    await supabase.from("tasks").update(updates).eq("id", id);
    fetchData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex items-center gap-3 text-muted-foreground">
          <div className="h-5 w-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <span className="text-sm">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-6">
      <div className="pt-10 md:pt-2 space-y-1">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/25">
            <CalendarDays className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Upcoming</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-2">Your next 7 days at a glance.</p>
      </div>

      {/* Overdue */}
      {overdue.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs font-semibold text-red-400 uppercase tracking-widest">
            Overdue
          </h2>
          <div className="space-y-2">
            {overdue.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                workspace={workspaceMap[task.workspace_id]}
                onToggle={handleToggle}
                onDelete={handleDelete}
                onEdit={setEditingTask}
              />
            ))}
          </div>
        </div>
      )}

      {/* 7-day view */}
      {days.map((day) => {
        const dayTasks = tasksByDay.get(day) || [];
        const isToday = day === today;
        return (
          <div key={day} className="space-y-3">
            <h2
              className={cn(
                "text-xs font-medium uppercase tracking-widest",
                isToday ? "text-indigo-400" : "text-muted-foreground"
              )}
            >
              {formatDayLabel(day)}
              {dayTasks.length > 0 && (
                <span className="ml-2 text-muted-foreground font-normal">
                  ({dayTasks.length})
                </span>
              )}
            </h2>
            {dayTasks.length > 0 ? (
              <div className="space-y-2">
                {dayTasks.map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    workspace={workspaceMap[task.workspace_id]}
                    onToggle={handleToggle}
                    onDelete={handleDelete}
                    onEdit={setEditingTask}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border/40 bg-card/20 p-4 text-center">
                <p className="text-xs text-muted-foreground/60">Nothing planned</p>
              </div>
            )}
          </div>
        );
      })}

      <EditTaskDialog
        task={editingTask}
        workspaces={workspaces}
        open={!!editingTask}
        onClose={() => setEditingTask(null)}
        onSave={handleEdit}
      />
    </div>
  );
}
