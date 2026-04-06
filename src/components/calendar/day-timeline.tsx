"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarEvent, Task, RoutineBlock } from "@/types/database";
import { cn } from "@/lib/utils";
import { MapPin, Video, Clock, Users, CheckSquare } from "lucide-react";

type DayTimelineProps = {
  events: CalendarEvent[];
  scheduledTasks?: Task[];
  routineBlocks?: RoutineBlock[];
  date: Date;
  startHour?: number;
  endHour?: number;
  onEventClick?: (event: CalendarEvent) => void;
};

const HOUR_HEIGHT = 64; // px per hour

function getEventPosition(
  event: CalendarEvent,
  dayStart: Date,
  startHour: number
) {
  const eventStart = new Date(event.start_time);
  const eventEnd = new Date(event.end_time);

  // Clamp to the visible day
  const visibleStart = new Date(dayStart);
  visibleStart.setHours(startHour, 0, 0, 0);

  const clampedStart = eventStart < visibleStart ? visibleStart : eventStart;
  const startMinutes =
    (clampedStart.getHours() - startHour) * 60 + clampedStart.getMinutes();
  const durationMinutes =
    (eventEnd.getTime() - clampedStart.getTime()) / 60000;

  const top = (startMinutes / 60) * HOUR_HEIGHT;
  const height = Math.max((durationMinutes / 60) * HOUR_HEIGHT, 24); // minimum 24px

  return { top, height, startMinutes, durationMinutes };
}

function formatEventTime(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  const fmt = (d: Date) =>
    d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  return `${fmt(s)} – ${fmt(e)}`;
}

function formatDuration(start: string, end: string) {
  const minutes = (new Date(end).getTime() - new Date(start).getTime()) / 60000;
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function DayTimeline({
  events,
  scheduledTasks = [],
  routineBlocks = [],
  date,
  startHour = 6,
  endHour = 22,
  onEventClick,
}: DayTimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const nowRef = useRef<HTMLDivElement>(null);
  const [, setTick] = useState(0);

  const isToday = date.toDateString() === new Date().toDateString();
  const hours = Array.from(
    { length: endHour - startHour },
    (_, i) => startHour + i
  );
  const totalHeight = hours.length * HOUR_HEIGHT;

  // Scroll to current time on mount
  useEffect(() => {
    if (isToday && nowRef.current && containerRef.current) {
      const container = containerRef.current;
      const nowLine = nowRef.current;
      const scrollTo = nowLine.offsetTop - container.clientHeight / 3;
      container.scrollTo({ top: Math.max(0, scrollTo), behavior: "smooth" });
    }
  }, [isToday]);

  // Update current time indicator every minute
  useEffect(() => {
    if (!isToday) return;
    const interval = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(interval);
  }, [isToday]);

  // Current time position
  const now = new Date();
  const nowMinutes = (now.getHours() - startHour) * 60 + now.getMinutes();
  const nowTop = (nowMinutes / 60) * HOUR_HEIGHT;
  const showNowLine =
    isToday && now.getHours() >= startHour && now.getHours() < endHour;

  // Convert scheduled tasks to timeline items
  const taskEvents: CalendarEvent[] = scheduledTasks
    .filter((t) => t.scheduled_start && t.scheduled_end)
    .map((t) => ({
      id: `task-${t.id}`,
      user_id: "",
      workspace_id: t.workspace_id,
      connection_id: null,
      external_id: null,
      external_calendar_id: null,
      title: t.title,
      description: null,
      location: null,
      start_time: t.scheduled_start!,
      end_time: t.scheduled_end!,
      all_day: false,
      timezone: "America/New_York",
      status: "confirmed" as const,
      recurrence_rule: null,
      meeting_url: null,
      meeting_provider: null,
      attendees: [],
      color: t.is_focus ? "#8b5cf6" : "#6b7280",
      source: "local" as const,
      is_read_only: false,
      raw_data: null,
      task_id: t.id,
      created_at: "",
      updated_at: "",
    }));

  // Separate all-day events
  const allDayEvents = events.filter((e) => e.all_day);
  const timedEvents = [...events.filter((e) => !e.all_day), ...taskEvents];

  // Resolve overlapping events into columns
  const columns = resolveOverlaps(timedEvents, date, startHour);

  return (
    <div className="space-y-2">
      {/* All-day events */}
      {allDayEvents.length > 0 && (
        <div className="space-y-1 pb-2">
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
            All Day
          </span>
          <div className="flex flex-wrap gap-1.5">
            {allDayEvents.map((event) => (
              <div
                key={event.id}
                onClick={() => onEventClick?.(event)}
                className="flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium cursor-pointer hover:brightness-125"
                style={{
                  backgroundColor: `${event.color || "#3b82f6"}18`,
                  color: event.color || "#3b82f6",
                  borderLeft: `3px solid ${event.color || "#3b82f6"}`,
                }}
              >
                {event.title}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Timeline */}
      <div
        ref={containerRef}
        className="relative overflow-y-auto overflow-x-hidden rounded-lg border border-border/40 bg-card/20"
        style={{ maxHeight: "calc(100dvh - 240px)" }}
      >
        <div className="relative" style={{ height: totalHeight }}>
          {/* Hour grid lines */}
          {hours.map((hour, i) => (
            <div
              key={hour}
              className="absolute left-0 right-0 border-t border-border/20"
              style={{ top: i * HOUR_HEIGHT }}
            >
              <span className="absolute -top-2.5 left-3 text-[10px] font-mono text-muted-foreground/50 tabular-nums select-none">
                {hour === 0
                  ? "12 AM"
                  : hour < 12
                  ? `${hour} AM`
                  : hour === 12
                  ? "12 PM"
                  : `${hour - 12} PM`}
              </span>
            </div>
          ))}

          {/* Half-hour grid lines */}
          {hours.map((_, i) => (
            <div
              key={`half-${i}`}
              className="absolute left-12 md:left-16 right-0 border-t border-border/8"
              style={{ top: i * HOUR_HEIGHT + HOUR_HEIGHT / 2 }}
            />
          ))}

          {/* Routine blocks (background bands) */}
          {routineBlocks.map((block) => {
            const [startH, startM] = block.start_time.split(":").map(Number);
            const [endH, endM] = block.end_time.split(":").map(Number);
            const blockStartMin = (startH - startHour) * 60 + startM;
            const blockEndMin = (endH - startHour) * 60 + endM;
            if (blockEndMin <= 0 || blockStartMin >= (endHour - startHour) * 60) return null;
            const top = Math.max(0, (blockStartMin / 60) * HOUR_HEIGHT);
            const height = ((Math.min(blockEndMin, (endHour - startHour) * 60) - Math.max(blockStartMin, 0)) / 60) * HOUR_HEIGHT;
            return (
              <div
                key={block.id}
                className="absolute left-12 md:left-16 right-2 md:right-3 rounded-md pointer-events-none"
                style={{
                  top,
                  height,
                  backgroundColor: `${block.color}08`,
                  borderLeft: `2px dashed ${block.color}30`,
                }}
              >
                <span
                  className="absolute top-1 left-2 text-[10px] font-medium select-none"
                  style={{ color: `${block.color}50` }}
                >
                  {block.icon} {block.label}
                </span>
              </div>
            );
          })}

          {/* Event blocks */}
          <div className="absolute left-12 md:left-16 right-2 md:right-3 top-0 bottom-0">
            {columns.map((col) =>
              col.events.map((event) => {
                const pos = getEventPosition(event, date, startHour);
                const isCompact = pos.height < 48;
                const isTask = event.task_id !== null;

                return (
                  <div
                    key={event.id}
                    onClick={() => !isTask && onEventClick?.(event)}
                    className={cn(
                      "absolute rounded-md overflow-hidden transition-colors group",
                      onEventClick && !isTask ? "cursor-pointer hover:brightness-125" : "cursor-default hover:brightness-110",
                      isTask && "border border-dashed border-current/20"
                    )}
                    style={{
                      top: pos.top,
                      height: pos.height,
                      left: `${col.leftPercent}%`,
                      width: `${col.widthPercent}%`,
                      backgroundColor: `${event.color || "#3b82f6"}${isTask ? "0a" : "14"}`,
                      borderLeft: `3px ${isTask ? "dashed" : "solid"} ${event.color || "#3b82f6"}`,
                    }}
                  >
                    <div
                      className={cn(
                        "h-full px-2.5 flex flex-col justify-center",
                        isCompact ? "py-0.5" : "py-2"
                      )}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        {isTask && (
                          <CheckSquare
                            className="size-3 shrink-0"
                            style={{ color: event.color || "#6b7280" }}
                          />
                        )}
                        <span
                          className={cn(
                            "font-medium truncate",
                            isCompact ? "text-[11px]" : "text-xs"
                          )}
                          style={{ color: event.color || "#3b82f6" }}
                        >
                          {event.title}
                        </span>
                        {event.meeting_url && (
                          <a
                            href={event.meeting_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Video
                              className="size-3"
                              style={{ color: event.color || "#3b82f6" }}
                            />
                          </a>
                        )}
                      </div>

                      {!isCompact && (
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-muted-foreground tabular-nums flex items-center gap-1">
                            <Clock className="size-2.5" />
                            {formatEventTime(event.start_time, event.end_time)}
                          </span>
                          <span className="text-[10px] text-muted-foreground/60">
                            {formatDuration(event.start_time, event.end_time)}
                          </span>
                        </div>
                      )}

                      {!isCompact && pos.height > 64 && (
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {event.location && (
                            <span className="text-[10px] text-muted-foreground/60 flex items-center gap-0.5 truncate max-w-[200px]">
                              <MapPin className="size-2.5 shrink-0" />
                              {event.location}
                            </span>
                          )}
                          {event.attendees && event.attendees.length > 0 && (
                            <span className="text-[10px] text-muted-foreground/60 flex items-center gap-0.5">
                              <Users className="size-2.5" />
                              {event.attendees.length}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Current time indicator */}
          {showNowLine && (
            <div
              ref={nowRef}
              className="absolute left-0 right-0 z-10 pointer-events-none"
              style={{ top: nowTop }}
            >
              <div className="flex items-center">
                <div className="size-2.5 rounded-full bg-red-500 -ml-[5px] shadow-sm shadow-red-500/30" />
                <div className="flex-1 h-[1.5px] bg-red-500/70" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Empty state */}
      {events.length === 0 && (
        <div className="text-center py-8">
          <p className="text-sm text-muted-foreground text-pretty">
            No events scheduled
          </p>
        </div>
      )}
    </div>
  );
}

// Overlap resolution: assign non-overlapping columns
type EventColumn = {
  events: CalendarEvent[];
  leftPercent: number;
  widthPercent: number;
};

function resolveOverlaps(
  events: CalendarEvent[],
  date: Date,
  startHour: number
): EventColumn[] {
  if (events.length === 0) return [];

  // Sort by start time, then by duration (longer first)
  const sorted = [...events].sort((a, b) => {
    const aStart = new Date(a.start_time).getTime();
    const bStart = new Date(b.start_time).getTime();
    if (aStart !== bStart) return aStart - bStart;
    const aDur =
      new Date(a.end_time).getTime() - new Date(a.start_time).getTime();
    const bDur =
      new Date(b.end_time).getTime() - new Date(b.start_time).getTime();
    return bDur - aDur;
  });

  // Assign columns using greedy algorithm
  const columns: { events: CalendarEvent[]; end: number }[] = [];

  for (const event of sorted) {
    const start = new Date(event.start_time).getTime();
    const end = new Date(event.end_time).getTime();

    let placed = false;
    for (const col of columns) {
      if (start >= col.end) {
        col.events.push(event);
        col.end = end;
        placed = true;
        break;
      }
    }

    if (!placed) {
      columns.push({ events: [event], end });
    }
  }

  // Convert to positioned columns
  const totalColumns = columns.length;
  return columns.map((col, i) => ({
    events: col.events,
    leftPercent: (i / totalColumns) * 100,
    widthPercent: (1 / totalColumns) * 100 - 1, // 1% gap
  }));
}
