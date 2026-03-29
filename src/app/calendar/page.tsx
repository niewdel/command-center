"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useCalendar, type CalendarView } from "@/lib/hooks/use-calendar";
import { CalendarWeekView } from "@/components/calendar/calendar-week-view";
import { CalendarDayView } from "@/components/calendar/calendar-day-view";
import { CalendarMonthView } from "@/components/calendar/calendar-month-view";
import { CreateEventDialog } from "@/components/calendar/create-event-dialog";
import { EventDetailSheet } from "@/components/calendar/event-detail-sheet";
import type { CalendarEvent } from "@/types/database";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const VIEW_OPTIONS: { value: CalendarView; label: string }[] = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
];

export default function CalendarPage() {
  const {
    events,
    loading,
    currentDate,
    view,
    setView,
    navigateDate,
    refetch,
  } = useCalendar();

  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(
    null
  );
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createDefaults, setCreateDefaults] = useState<{
    date?: Date;
    hour?: number;
  }>({});

  // Responsive: default to day view on mobile
  useEffect(() => {
    if (window.innerWidth < 768) {
      setView("day");
    }
  }, [setView]);

  const handleSlotClick = (date: Date, hour: number) => {
    setCreateDefaults({ date, hour });
    setCreateDialogOpen(true);
  };

  const handleDayClick = (date: Date) => {
    // In month view, clicking a day switches to day view for that date
    setView("day");
    navigateDate("today"); // Reset first
    // We need to set the date directly, but navigateDate doesn't support arbitrary dates
    // So we'll use a small workaround
    setTimeout(() => {
      const event = new CustomEvent("calendar-navigate", { detail: date });
      window.dispatchEvent(event);
    }, 0);
  };

  const headerTitle = (() => {
    if (view === "day") {
      return currentDate.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    }
    if (view === "week") {
      const start = new Date(currentDate);
      start.setDate(start.getDate() - start.getDay());
      const end = new Date(start);
      end.setDate(end.getDate() + 6);

      if (start.getMonth() === end.getMonth()) {
        return `${start.toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
        })}`;
      }
      return `${start.toLocaleDateString("en-US", {
        month: "short",
      })} - ${end.toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      })}`;
    }
    return currentDate.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
  })();

  if (loading) {
    return (
      <div className="flex flex-col h-dvh pb-20 md:pb-0">
        {/* Skeleton header */}
        <div className="px-4 md:px-6 py-4 border-b border-border/50 bg-card/50">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-muted animate-pulse" />
            <div className="h-6 w-48 rounded-md bg-muted animate-pulse" />
          </div>
        </div>
        {/* Skeleton grid */}
        <div className="flex-1 p-4 md:p-6 space-y-2">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="flex gap-2">
              <div className="w-12 h-8 rounded bg-muted/50 animate-pulse" />
              <div className="flex-1 h-8 rounded bg-muted/30 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-dvh pb-20 md:pb-0">
      {/* Header */}
      <div className="pt-10 md:pt-0 px-4 md:px-6 py-4 border-b border-border/50 flex flex-col sm:flex-row sm:items-center gap-3 bg-card/50 sticky top-0 z-20">
        <div className="flex items-center gap-3 flex-1">
          <div className="size-10 rounded-lg bg-foreground flex items-center justify-center shadow-md">
            <Calendar className="size-5 text-background" />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigateDate("prev")}
              className="p-1.5 rounded-lg hover:bg-accent transition-colors"
            >
              <ChevronLeft className="size-4" />
            </button>
            <h1 className="text-lg font-semibold text-balance min-w-[200px] text-center font-heading">
              {headerTitle}
            </h1>
            <button
              onClick={() => navigateDate("next")}
              className="p-1.5 rounded-lg hover:bg-accent transition-colors"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Today button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigateDate("today")}
            className="rounded-lg text-xs"
          >
            Today
          </Button>

          {/* View toggle */}
          <div className="flex rounded-lg border border-border/50 overflow-hidden">
            {VIEW_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setView(opt.value)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium transition-colors",
                  view === opt.value
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* New event button */}
          <Button
            size="sm"
            onClick={() => {
              setCreateDefaults({});
              setCreateDialogOpen(true);
            }}
            className="gap-1.5 rounded-lg bg-foreground hover:bg-foreground/90 text-background border-0 shadow-md"
          >
            <Plus className="size-3.5" />
            <span className="hidden sm:inline">New Event</span>
          </Button>
        </div>
      </div>

      {/* Calendar view */}
      <div className="flex-1 overflow-hidden">
        {view === "week" && (
          <CalendarWeekView
            currentDate={currentDate}
            events={events}
            onEventClick={setSelectedEvent}
            onSlotClick={handleSlotClick}
          />
        )}
        {view === "day" && (
          <CalendarDayView
            currentDate={currentDate}
            events={events}
            onEventClick={setSelectedEvent}
            onSlotClick={handleSlotClick}
          />
        )}
        {view === "month" && (
          <CalendarMonthView
            currentDate={currentDate}
            events={events}
            onEventClick={setSelectedEvent}
            onDayClick={handleDayClick}
          />
        )}
      </div>

      {/* Event detail sheet */}
      <EventDetailSheet
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
        onDeleted={refetch}
      />

      {/* Create event dialog */}
      <CreateEventDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onCreated={refetch}
        defaultDate={createDefaults.date}
        defaultStartHour={createDefaults.hour}
      />
    </div>
  );
}
