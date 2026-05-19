import { RoutineTemplate, RoutineBlock, CalendarEvent } from "@/types/database";
import { localDateString } from "@/lib/utils";

export function getRoutineForDate(
  _date: Date,
  templates: RoutineTemplate[]
): RoutineTemplate | null {
  // Single daily routine — return the first active template
  return templates.find((t) => t.is_active) || null;
}

export function routineBlocksToEvents(
  blocks: RoutineBlock[],
  date: Date
): CalendarEvent[] {
  const dateStr = localDateString(date);

  return blocks.map((block) => {
    const [startH, startM] = block.start_time.split(":").map(Number);
    const [endH, endM] = block.end_time.split(":").map(Number);

    const startDate = new Date(date);
    startDate.setHours(startH, startM, 0, 0);
    const endDate = new Date(date);
    endDate.setHours(endH, endM, 0, 0);

    return {
      id: `routine-${block.id}-${dateStr}`,
      user_id: "",
      workspace_id: null,
      connection_id: null,
      external_id: `routine-${block.id}`,
      external_calendar_id: null,
      title: `${block.icon || ""} ${block.label}`.trim(),
      description: null,
      location: null,
      start_time: startDate.toISOString(),
      end_time: endDate.toISOString(),
      all_day: false,
      timezone: "America/New_York",
      status: "confirmed" as const,
      recurrence_rule: null,
      meeting_url: null,
      meeting_provider: null,
      attendees: [],
      color: block.color,
      source: "local" as const,
      is_read_only: true,
      raw_data: { isRoutine: true },
      task_id: null,
      created_at: "",
      updated_at: "",
    };
  });
}

export function getRoutineMinutes(blocks: RoutineBlock[]): number {
  return blocks.reduce((sum, block) => {
    const [startH, startM] = block.start_time.split(":").map(Number);
    const [endH, endM] = block.end_time.split(":").map(Number);
    const minutes = (endH * 60 + endM) - (startH * 60 + startM);
    return sum + Math.max(0, minutes);
  }, 0);
}

export function getNextRoutineBlock(
  blocks: RoutineBlock[]
): RoutineBlock | null {
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const upcoming = blocks
    .filter((b) => {
      const [h, m] = b.start_time.split(":").map(Number);
      return h * 60 + m > nowMinutes;
    })
    .sort((a, b) => {
      const [aH, aM] = a.start_time.split(":").map(Number);
      const [bH, bM] = b.start_time.split(":").map(Number);
      return (aH * 60 + aM) - (bH * 60 + bM);
    });

  return upcoming[0] || null;
}

export function formatRoutineTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return m === 0 ? `${hour} ${period}` : `${hour}:${m.toString().padStart(2, "0")} ${period}`;
}
