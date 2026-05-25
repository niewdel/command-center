"use client";

import { useMemo } from "react";
import { CalendarEvent } from "@/types/database";
import { cn, localDateString } from "@/lib/utils";

type MonthViewProps = {
  events: CalendarEvent[];
  selectedDate: Date;
  onDateClick: (date: Date) => void;
  onEventClick?: (event: CalendarEvent) => void;
};

function getMonthGrid(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startOffset = firstDay.getDay(); // 0=Sun
  const totalDays = lastDay.getDate();

  const weeks: (Date | null)[][] = [];
  let currentWeek: (Date | null)[] = [];

  // Pad start with previous month days
  for (let i = 0; i < startOffset; i++) {
    const d = new Date(year, month, -(startOffset - 1 - i));
    currentWeek.push(d);
  }

  for (let day = 1; day <= totalDays; day++) {
    currentWeek.push(new Date(year, month, day));
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }

  // Pad end with next month days
  if (currentWeek.length > 0) {
    let nextDay = 1;
    while (currentWeek.length < 7) {
      currentWeek.push(new Date(year, month + 1, nextDay++));
    }
    weeks.push(currentWeek);
  }

  return weeks;
}

function getDayEvents(events: CalendarEvent[], date: Date) {
  const dayStr = localDateString(date);
  return events.filter((e) => {
    const eventDate = localDateString(new Date(e.start_time));
    return eventDate === dayStr;
  });
}

export function MonthView({
  events,
  selectedDate,
  onDateClick,
  onEventClick,
}: MonthViewProps) {
  const year = selectedDate.getFullYear();
  const month = selectedDate.getMonth();

  const weeks = useMemo(() => getMonthGrid(year, month), [year, month]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = localDateString(today);
  const selectedStr = localDateString(selectedDate);

  return (
    <div className="rounded-lg border border-border/40 overflow-hidden">
      {/* Day headers */}
      <div className="grid grid-cols-7 bg-card/30 border-b border-border/20">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div
            key={day}
            className="text-center py-2 text-[10px] uppercase text-muted-foreground/60 font-medium"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Weeks */}
      {weeks.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7 border-b border-border/10 last:border-b-0">
          {week.map((date) => {
            if (!date) return <div key="null" />;
            const dateStr = localDateString(date);
            const isToday = dateStr === todayStr;
            const isSelected = dateStr === selectedStr;
            const isCurrentMonth = date.getMonth() === month;
            const isWeekend = date.getDay() === 0 || date.getDay() === 6;
            const dayEvents = getDayEvents(events, date);
            const maxVisible = 3;

            return (
              <button
                key={dateStr}
                onClick={() => onDateClick(date)}
                className={cn(
                  "min-h-[80px] md:min-h-[100px] p-1 md:p-1.5 text-left transition-colors relative",
                  "hover:bg-card/40",
                  isSelected && "bg-primary/5",
                  !isCurrentMonth && "opacity-30"
                )}
              >
                {/* Date number */}
                <div className="flex justify-end">
                  <span
                    className={cn(
                      "size-6 md:size-7 rounded-full flex items-center justify-center text-xs tabular-nums font-medium",
                      isToday && "bg-foreground text-background",
                      !isToday && isWeekend && "text-muted-foreground/50",
                      !isToday && !isWeekend && "text-foreground"
                    )}
                  >
                    {date.getDate()}
                  </span>
                </div>

                {/* Events */}
                <div className="space-y-0.5 mt-0.5">
                  {dayEvents.slice(0, maxVisible).map((event) => (
                    <div
                      key={event.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEventClick?.(event);
                      }}
                      className="text-[9px] md:text-[10px] font-medium truncate rounded px-1 py-0.5 cursor-pointer hover:brightness-125"
                      style={{
                        backgroundColor: `${event.color || "var(--rust)"}15`,
                        color: event.color || "var(--rust)",
                        border: `1px solid ${event.color || "var(--rust)"}`,
                      }}
                    >
                      {event.all_day
                        ? event.title
                        : `${new Date(event.start_time).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} ${event.title}`}
                    </div>
                  ))}
                  {dayEvents.length > maxVisible && (
                    <div className="text-[9px] text-muted-foreground pl-1">
                      +{dayEvents.length - maxVisible} more
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
