"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { EventBlock } from "@/components/calendar/event-block";
import type { CalendarEvent } from "@/types/database";

const HOURS = Array.from({ length: 17 }, (_, i) => i + 6); // 6am - 10pm
const HOUR_HEIGHT = 60; // px per hour

function getEventPosition(event: CalendarEvent) {
  const start = new Date(event.start_time);
  const end = new Date(event.end_time);
  const startMinutes = start.getHours() * 60 + start.getMinutes();
  const endMinutes = end.getHours() * 60 + end.getMinutes();

  const top = ((startMinutes - 360) / 60) * HOUR_HEIGHT; // 360 = 6am in minutes
  const height = Math.max(((endMinutes - startMinutes) / 60) * HOUR_HEIGHT, 20);

  return { top, height };
}

type CalendarWeekViewProps = {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  onSlotClick: (date: Date, hour: number) => void;
};

export function CalendarWeekView({
  currentDate,
  events,
  onEventClick,
  onSlotClick,
}: CalendarWeekViewProps) {
  const weekDays = useMemo(() => {
    const start = new Date(currentDate);
    start.setDate(start.getDate() - start.getDay());
    return Array.from({ length: 7 }, (_, i) => {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      return day;
    });
  }, [currentDate]);

  const eventsByDay = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    events.forEach((event) => {
      const dateKey = new Date(event.start_time).toDateString();
      if (!map[dateKey]) map[dateKey] = [];
      map[dateKey].push(event);
    });
    return map;
  }, [events]);

  const today = new Date().toDateString();

  // Current time indicator
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const currentTimeTop = ((currentMinutes - 360) / 60) * HOUR_HEIGHT;
  const showCurrentTime =
    currentMinutes >= 360 && currentMinutes <= 1320; // 6am - 10pm

  return (
    <div className="flex flex-col h-full">
      {/* Day headers */}
      <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border/50 sticky top-0 bg-card z-10">
        <div /> {/* Gutter */}
        {weekDays.map((day) => {
          const isToday = day.toDateString() === today;
          return (
            <div
              key={day.toISOString()}
              className={cn(
                "text-center py-3 border-l border-border/30",
                isToday && "bg-indigo-500/5"
              )}
            >
              <p className="text-[10px] font-medium uppercase text-pretty text-muted-foreground">
                {day.toLocaleDateString("en-US", { weekday: "short" })}
              </p>
              <p
                className={cn(
                  "text-lg font-semibold mt-0.5 text-pretty",
                  isToday
                    ? "text-indigo-400"
                    : "text-foreground"
                )}
              >
                {day.getDate()}
              </p>
            </div>
          );
        })}
      </div>

      {/* Time grid */}
      <div className="flex-1 overflow-y-auto">
        <div
          className="grid grid-cols-[60px_repeat(7,1fr)] relative"
          style={{ height: HOURS.length * HOUR_HEIGHT }}
        >
          {/* Hour labels */}
          <div className="relative">
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="absolute w-full text-right pr-2"
                style={{ top: (hour - 6) * HOUR_HEIGHT - 6 }}
              >
                <span className="text-[10px] text-muted-foreground/60">
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

          {/* Day columns */}
          {weekDays.map((day) => {
            const isToday = day.toDateString() === today;
            const dayEvents = eventsByDay[day.toDateString()] || [];

            return (
              <div
                key={day.toISOString()}
                className={cn(
                  "relative border-l border-border/30",
                  isToday && "bg-indigo-500/[0.02]"
                )}
              >
                {/* Hour grid lines */}
                {HOURS.map((hour) => (
                  <div
                    key={hour}
                    className="absolute w-full border-t border-border/20 cursor-pointer hover:bg-accent/30 transition-colors"
                    style={{
                      top: (hour - 6) * HOUR_HEIGHT,
                      height: HOUR_HEIGHT,
                    }}
                    onClick={() => onSlotClick(day, hour)}
                  />
                ))}

                {/* Events */}
                {dayEvents
                  .filter((e) => !e.all_day)
                  .map((event) => {
                    const pos = getEventPosition(event);
                    return (
                      <div
                        key={event.id}
                        className="absolute left-1 right-1 z-10"
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
                {isToday && showCurrentTime && (
                  <div
                    className="absolute left-0 right-0 z-20 flex items-center"
                    style={{ top: currentTimeTop }}
                  >
                    <div className="size-2.5 rounded-full bg-red-500 -ml-1" />
                    <div className="flex-1 h-[2px] bg-red-500" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
