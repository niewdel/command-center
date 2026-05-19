import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * YYYY-MM-DD in the caller's local timezone. Use this for any "today"
 * comparison against a date column (planned_date, due_date, completed_at).
 *
 * Do NOT use `new Date().toISOString().split("T")[0]` — that returns UTC,
 * so late evening in the Americas reads as tomorrow's date and breaks
 * task filtering / "Today" headers.
 */
export function localDateString(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
