import { Task, UserSettings } from "@/types/database";

export type CapacityLevel = "green" | "yellow" | "red";

export type CapacityInfo = {
  estimatedMinutes: number;
  availableMinutes: number;
  percentage: number;
  level: CapacityLevel;
  remainingMinutes: number;
  tasksWithEstimates: number;
  tasksWithoutEstimates: number;
};

const DEFAULT_WEEKDAY_HOURS = 8;
const DEFAULT_WEEKEND_HOURS = 4;

export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

export function getAvailableMinutes(
  date: Date,
  settings?: UserSettings | null
): number {
  const hours = isWeekend(date)
    ? (settings?.available_hours_weekend ?? DEFAULT_WEEKEND_HOURS)
    : (settings?.available_hours_weekday ?? DEFAULT_WEEKDAY_HOURS);
  return hours * 60;
}

export function calculateCapacity(
  tasks: Task[],
  date: Date,
  settings?: UserSettings | null
): CapacityInfo {
  const todayStr = date.toISOString().split("T")[0];
  const plannedTasks = tasks.filter(
    (t) => t.planned_date === todayStr && t.status !== "done"
  );

  const tasksWithEstimates = plannedTasks.filter(
    (t) => t.estimated_minutes !== null && t.estimated_minutes > 0
  );
  const tasksWithoutEstimates = plannedTasks.filter(
    (t) => !t.estimated_minutes
  );

  const estimatedMinutes = tasksWithEstimates.reduce(
    (sum, t) => sum + (t.estimated_minutes || 0),
    0
  );

  const availableMinutes = getAvailableMinutes(date, settings);
  const percentage =
    availableMinutes > 0
      ? Math.round((estimatedMinutes / availableMinutes) * 100)
      : 0;

  let level: CapacityLevel = "green";
  if (percentage >= 100) level = "red";
  else if (percentage >= 80) level = "yellow";

  return {
    estimatedMinutes,
    availableMinutes,
    percentage,
    level,
    remainingMinutes: availableMinutes - estimatedMinutes,
    tasksWithEstimates: tasksWithEstimates.length,
    tasksWithoutEstimates: tasksWithoutEstimates.length,
  };
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

export const ESTIMATE_PRESETS = [
  { label: "15m", value: 15 },
  { label: "30m", value: 30 },
  { label: "1h", value: 60 },
  { label: "2h", value: 120 },
  { label: "4h", value: 240 },
] as const;
