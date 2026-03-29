"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { EventBlock } from "@/components/calendar/event-block";
import type { CalendarEvent } from "@/types/database";

const HOURS = Array.from({ length: 17 }, (_, i) => i + 6); // 6am - 10pm
const HOUR_HEIGHT = 64; // slightly taller for day view

function getEventPosition(event: CalendarEvent) {
  const start = new Date(event.start_time);
  const end = new Date(event.end_time);
  const startMinutes = start.getHours() * 60 + start.getMinutes();
  const endMinutes = end.getHours() * 60 + end.getMinutes();

  const top = ((startMinutes - 360) / 60) * HOUR_HEIGHT;
  const height = Math.max(((endMinutes - startMinutes) / 60) * HOUR_HEIGHT, 24);

  return { top, height };
}

type CalendarDayViewProps = {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  onSlotClick: (date: Date, hour: number) => void;
};

export function CalendarDayView({
  currentDate,
  events,
  onEventClick,
  onSlotClick,
}: CalendarDayViewProps) {
  const dayEvents = useMemo(() => {
    const dateKey = currentDate.toDateString();
    return events.filter(
      (e) => new Date(e.start_time).toDateString() === dateKey
    );
  }, [events, currentDate]);

  const allDayEvents = dayEvents.filter((e) => e.all_day);
  const timedEvents = dayEvents.filter((e) => !e.all_day);

  const isToday = currentDate.toDateString() === new Date().toDateString();
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const currentTimeTop = ((currentMinutes - 360) / 60) * HOUR_HEIGHT;
  const showCurrentTime = isToday && currentMinutes >= 360 && currentMinutes <= 1320;

  const dateStr = currentDate.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="flex flex-col h-full">
      {/* Day header */}
      <div className="px-4 py-3 border-b border-border/50 sticky top-0 bg-card z-10">
        <p
          className={cn(
            "text-lg font-semibold text-pretty",
            isToday && "text-indigo-400"
          )}
        >
          {dateStr}
          {isToday && (
            <span className="ml-2 text-xs font-normal text-indigo-400/60">
              Today
            </span>
          )}
        </p>
      </div>

      {/* All day events */}
      {allDayEvents.length > 0 && (
        <div className="px-4 py-2 border-b border-border/50 space-y-1">
          <p className="text-[10px] font-medium text-muted-foreground uppercase text-pretty mb-1">
            All Day
          </p>
          {allDayEvents.map((event) => (
            <EventBlock
              key={event.id}
              event={event}
              onClick={() => onEventClick(event)}
              compact
            />
          ))}
        </div>
      )}

      {/* Time grid */}
      <div className="flex-1 overflow-y-auto">
        <div
          className="grid grid-cols-[60px_1fr] relative"
          style={{ height: HOURS.length * HOUR_HEIGHT }}
        >
          {/* Hour labels */}
          <div className="relative">
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="absolute w-full text-right pr-3"
                style={{ top: (hour - 6) * HOUR_HEIGHT - 6 }}
              >
                <span className="text-[11px] text-muted-foreground/60">
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
          </div>

          {/* Event column */}
          <div className="relative border-l border-border/30">
            {/* Hour grid lines */}
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="absolute w-full border-t border-border/20 cursor-pointer hover:bg-accent/30 transition-colors"
                style={{
                  top: (hour - 6) * HOUR_HEIGHT,
                  height: HOUR_HEIGHT,
                }}
                onClick={() => onSlotClick(currentDate, hour)}
              />
            ))}

            {/* Events */}
            {timedEvents.map((event) => {
              const pos = getEventPosition(event);
              return (
                <div
                  key={event.id}
                  className="absolute left-2 right-2 z-10"
                  style={{
                    top: pos.top,
                    height: pos.height,
                  }}
                >
                  <EventBlock
                    event={event}
                    onClick={() => onEventClick(event)}
                  />
                </div>
              );
            })}

            {/* Current time indicator */}
            {showCurrentTime && (
              <div
                className="absolute left-0 right-0 z-20 flex items-center"
                style={{ top: currentTimeTop }}
              >
                <div className="size-2.5 rounded-full bg-red-500 -ml-1" />
                <div className="flex-1 h-[2px] bg-red-500" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
