import type { CrmTask } from "@/types/pipeline";

/**
 * "My Day" bucketing (Task E3). Buckets only make sense for open tasks —
 * callers should filter out `done` tasks before bucketing.
 */
export type TaskBucket = "overdue" | "today" | "upcoming" | "later" | "no_due_date";

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Bucket a task by its due date relative to `now`: overdue / today / upcoming (next 7 days) / later / no due date. */
export function getTaskBucket(task: Pick<CrmTask, "due_date">, now: Date = new Date()): TaskBucket {
  if (!task.due_date) return "no_due_date";
  const due = new Date(task.due_date);
  const todayStart = startOfDay(now);
  const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  const in7DaysStart = new Date(todayStart.getTime() + 7 * 24 * 60 * 60 * 1000);

  if (due.getTime() < todayStart.getTime()) return "overdue";
  if (due.getTime() < tomorrowStart.getTime()) return "today";
  if (due.getTime() < in7DaysStart.getTime()) return "upcoming";
  return "later";
}

/** Whether an (open) task is overdue — due strictly before the start of today. */
export function isTaskOverdue(task: Pick<CrmTask, "due_date" | "done">, now: Date = new Date()): boolean {
  if (task.done || !task.due_date) return false;
  return new Date(task.due_date).getTime() < startOfDay(now).getTime();
}
