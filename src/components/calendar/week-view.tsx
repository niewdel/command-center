"use client";

import { CalendarEvent, Task } from "@/types/database";
import { cn } from "@/lib/utils";
import { Video, CheckSquare, Clock } from "lucide-react";

type WeekViewProps = {
  events: CalendarEvent[];
  scheduledTasks?: Task[];
  weekStart: Date;
  onEventClick?: (event: CalendarEvent) => void;
};

function getDayEvents(events: CalendarEvent[], date: Date) {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setDate(dayEnd.getDate() + 1);
  dayEnd.setHours(0, 0, 0, 0);

  return events.filter((e) => {
    const start = new Date(e.start_time);
    const end = new Date(e.end_time);
    return end > dayStart && start < dayEnd;
  });
}

function getDayTasks(tasks: Task[], date: Date) {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setDate(dayEnd.getDate() + 1);
  dayEnd.setHours(0, 0, 0, 0);

  return tasks.filter((t) => {
    if (!t.scheduled_start) return false;
    const start = new Date(t.scheduled_start);
    return start >= dayStart && start < dayEnd;
  });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function WeekView({ events, scheduledTasks = [], weekStart, onEventClick }: WeekViewProps) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div className="grid grid-cols-7 gap-px bg-border/20 rounded-lg border border-border/40 overflow-x-auto" style={{ minWidth: "min(100%, 560px)" }}>
      {days.map((day) => {
        const isToday = day.toDateString() === today.toDateString();
        const dayEvents = getDayEvents(events, day);
        const dayTasks = getDayTasks(scheduledTasks, day);
        const allDayEvents = dayEvents.filter((e) => e.all_day);
        const timedEvents = dayEvents
          .filter((e) => !e.all_day)
          .sort(
            (a, b) =>
              new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
          );

        return (
          <div
            key={day.toISOString()}
            className={cn(
              "bg-card/20 min-h-[180px] flex flex-col",
              isToday && "bg-primary/3"
            )}
          >
            {/* Day header */}
            <div
              className={cn(
                "px-2 py-2 text-center border-b border-border/20",
                isToday && "bg-primary/5"
              )}
            >
              <div className="text-[10px] uppercase text-muted-foreground/60 font-medium">
                {day.toLocaleDateString("en-US", { weekday: "short" })}
              </div>
              <div
                className={cn(
                  "text-sm font-semibold tabular-nums mt-0.5",
                  isToday
                    ? "text-primary"
                    : day.getDay() === 0 || day.getDay() === 6
                    ? "text-muted-foreground/60"
                    : "text-foreground"
                )}
              >
                {day.getDate()}
              </div>
            </div>

            {/* Events */}
            <div className="flex-1 p-1 space-y-0.5 overflow-y-auto">
              {/* All day events */}
              {allDayEvents.map((event) => (
                <div
                  key={event.id}
                  onClick={() => onEventClick?.(event)}
                  className="text-[10px] font-medium px-1.5 py-0.5 rounded truncate cursor-pointer hover:brightness-125"
                  style={{
                    backgroundColor: `${event.color || "var(--rust)"}18`,
                    color: event.color || "var(--rust)",
                    border: `1px solid ${event.color || "var(--rust)"}`,
                  }}
                >
                  {event.title}
                </div>
              ))}

              {/* Timed events */}
              {timedEvents.map((event) => (
                <div
                  key={event.id}
                  onClick={() => onEventClick?.(event)}
                  className="rounded px-1.5 py-1 group cursor-pointer hover:brightness-125"
                  style={{
                    backgroundColor: `${event.color || "var(--rust)"}10`,
                    border: `1px solid ${event.color || "var(--rust)"}`,
                  }}
                >
                  <div className="flex items-center gap-1">
                    <span
                      className="text-[10px] font-medium truncate"
                      style={{ color: event.color || "var(--rust)" }}
                    >
                      {event.title}
                    </span>
                    {event.meeting_url && (
                      <a
                        href={event.meeting_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Video
                          className="size-2.5"
                          style={{ color: event.color || "var(--rust)" }}
                        />
                      </a>
                    )}
                  </div>
                  <span className="text-[9px] text-muted-foreground/60 tabular-nums flex items-center gap-0.5">
                    <Clock className="size-2" />
                    {formatTime(event.start_time)}
                  </span>
                </div>
              ))}

              {/* Scheduled tasks */}
              {dayTasks.map((task) => (
                <div
                  key={task.id}
                  className="rounded px-1.5 py-1 border border-dashed border-muted-foreground/20"
                  style={{
                    backgroundColor: task.is_focus
                      ? "rgba(139, 92, 246, 0.06)"
                      : "rgba(107, 114, 128, 0.06)",
                  }}
                >
                  <div className="flex items-center gap-1">
                    <CheckSquare
                      className="size-2.5 shrink-0"
                      style={{
                        color: task.is_focus ? "#8b5cf6" : "#6b7280",
                      }}
                    />
                    <span
                      className="text-[10px] font-medium truncate"
                      style={{
                        color: task.is_focus ? "#8b5cf6" : "#9ca3af",
                      }}
                    >
                      {task.title}
                    </span>
                  </div>
                  {task.scheduled_start && (
                    <span className="text-[9px] text-muted-foreground/60 tabular-nums flex items-center gap-0.5">
                      <Clock className="size-2" />
                      {formatTime(task.scheduled_start)}
                    </span>
                  )}
                </div>
              ))}

              {/* Empty state */}
              {timedEvents.length === 0 &&
                allDayEvents.length === 0 &&
                dayTasks.length === 0 && (
                  <div className="h-full flex items-center justify-center">
                    <span className="text-[10px] text-muted-foreground/30">—</span>
                  </div>
                )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
