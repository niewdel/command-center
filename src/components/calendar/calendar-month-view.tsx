"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { CalendarEvent } from "@/types/database";

type CalendarMonthViewProps = {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  onDayClick: (date: Date) => void;
};

export function CalendarMonthView({
  currentDate,
  events,
  onEventClick,
  onDayClick,
}: CalendarMonthViewProps) {
  const { weeks, monthStart } = useMemo(() => {
    const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const startDay = start.getDay();

    // Start from the Sunday before the first of the month
    const gridStart = new Date(start);
    gridStart.setDate(gridStart.getDate() - startDay);

    const weeksArr: Date[][] = [];
    const current = new Date(gridStart);

    for (let w = 0; w < 6; w++) {
      const week: Date[] = [];
      for (let d = 0; d < 7; d++) {
        week.push(new Date(current));
        current.setDate(current.getDate() + 1);
      }
      weeksArr.push(week);
    }

    return { weeks: weeksArr, monthStart: start };
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

  return (
    <div className="flex flex-col h-full">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-border/50">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div
            key={day}
            className="text-center py-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Weeks */}
      <div className="flex-1 grid grid-rows-6">
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 border-b border-border/20">
            {week.map((day) => {
              const isToday = day.toDateString() === today;
              const isCurrentMonth = day.getMonth() === monthStart.getMonth();
              const dayEvents = eventsByDay[day.toDateString()] || [];

              return (
                <div
                  key={day.toISOString()}
                  onClick={() => onDayClick(day)}
                  className={cn(
                    "relative p-1.5 border-r border-border/20 cursor-pointer hover:bg-accent/30 transition-colors min-h-[80px]",
                    !isCurrentMonth && "opacity-30",
                    isToday && "bg-indigo-500/5"
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                      isToday
                        ? "bg-indigo-500 text-white"
                        : "text-foreground"
                    )}
                  >
                    {day.getDate()}
                  </span>

                  {/* Event dots / chips */}
                  <div className="mt-1 space-y-0.5">
                    {dayEvents.slice(0, 3).map((event) => (
                      <button
                        key={event.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onEventClick(event);
                        }}
                        className={cn(
                          "w-full text-left text-[10px] px-1.5 py-0.5 rounded truncate transition-colors",
                          event.source === "google"
                            ? "bg-blue-500/20 text-blue-300"
                            : event.source === "microsoft"
                            ? "bg-sky-500/20 text-sky-300"
                            : "bg-indigo-500/20 text-indigo-300"
                        )}
                      >
                        {event.all_day
                          ? event.title
                          : `${new Date(event.start_time).toLocaleTimeString(
                              "en-US",
                              { hour: "numeric", minute: "2-digit" }
                            )} ${event.title}`}
                      </button>
                    ))}
                    {dayEvents.length > 3 && (
                      <p className="text-[9px] text-muted-foreground/60 px-1.5">
                        +{dayEvents.length - 3} more
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
