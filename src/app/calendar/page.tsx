"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { CalendarEvent, CalendarConnection, Task, RoutineTemplate, RoutineBlock } from "@/types/database";
import { getRoutineForDate } from "@/lib/routines";
import { PageLayout } from "@/components/layout/page-layout";
import { DayTimeline } from "@/components/calendar/day-timeline";
import { WeekView } from "@/components/calendar/week-view";
import { MonthView } from "@/components/calendar/month-view";
import { EventDetail } from "@/components/calendar/event-detail";
import { CreateEventDialog } from "@/components/calendar/create-event-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { triggerCalendarSync } from "@/lib/calendar-sync";
import { CalendarDays, ChevronLeft, ChevronRight, LayoutList, Grid3X3, CalendarRange, Plus } from "lucide-react";

type ViewMode = "day" | "week" | "month";

function formatDateHeading(date: Date, viewMode: ViewMode): string {
  if (viewMode === "month") {
    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }

  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const isToday = date.toDateString() === today.toDateString();
  const isTomorrow = date.toDateString() === tomorrow.toDateString();
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const formatted = date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  if (isToday) return `Today · ${formatted}`;
  if (isTomorrow) return `Tomorrow · ${formatted}`;
  if (isYesterday) return `Yesterday · ${formatted}`;
  return formatted;
}

export default function CalendarPage() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("day");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [scheduledTasks, setScheduledTasks] = useState<Task[]>([]);
  const [connections, setConnections] = useState<CalendarConnection[]>([]);
  const [routineTemplates, setRoutineTemplates] = useState<RoutineTemplate[]>([]);
  const [routineBlocks, setRoutineBlocks] = useState<RoutineBlock[]>([]);
  const [visibleConnectionIds, setVisibleConnectionIds] = useState<Set<string>>(new Set());
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [loading, setLoading] = useState(true);

  // Compute date range based on view mode
  const weekStart = useMemo(() => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - d.getDay());
    d.setHours(0, 0, 0, 0);
    return d;
  }, [selectedDate]);

  const dateRange = useMemo(() => {
    if (viewMode === "month") {
      // Fetch full month + padding
      const first = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
      const last = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);
      // Pad to include full weeks
      const start = new Date(first);
      start.setDate(start.getDate() - start.getDay());
      const end = new Date(last);
      end.setDate(end.getDate() + (6 - end.getDay()) + 1);
      return { start: start.toISOString(), end: end.toISOString() };
    }
    if (viewMode === "week") {
      const end = new Date(weekStart);
      end.setDate(end.getDate() + 7);
      return { start: weekStart.toISOString(), end: end.toISOString() };
    }
    const dayStart = new Date(selectedDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(selectedDate);
    dayEnd.setDate(dayEnd.getDate() + 1);
    dayEnd.setHours(0, 0, 0, 0);
    return { start: dayStart.toISOString(), end: dayEnd.toISOString() };
  }, [selectedDate, viewMode, weekStart]);

  const fetchData = useCallback(async () => {
    const [{ data: evts }, { data: conns }, { data: tasks }, { data: rt }, { data: rb }] = await Promise.all([
      supabase
        .from("calendar_events")
        .select("*")
        .gte("end_time", dateRange.start)
        .lt("start_time", dateRange.end)
        .neq("status", "cancelled")
        .order("start_time", { ascending: true }),
      supabase
        .from("calendar_connections")
        .select("*, workspaces:workspace_id(color)")
        .eq("is_active", true)
        .order("created_at", { ascending: true }),
      supabase
        .from("tasks")
        .select("*")
        .not("scheduled_start", "is", null)
        .gte("scheduled_end", dateRange.start)
        .lt("scheduled_start", dateRange.end)
        .neq("status", "done"),
      supabase.from("routine_templates").select("*").eq("is_active", true).order("position"),
      supabase.from("routine_blocks").select("*").order("position"),
    ]);

    setEvents(evts || []);
    setScheduledTasks(tasks || []);
    setRoutineTemplates(rt || []);
    setRoutineBlocks(rb || []);
    // Prefer workspace color over connection color for legend display
    const resolvedConns = (conns || []).map((c: CalendarConnection & { workspaces?: { color: string } | null }) => ({
      ...c,
      color: c.workspaces?.color || c.color,
    }));
    setConnections(resolvedConns);
    if (visibleConnectionIds.size === 0 && conns && conns.length > 0) {
      setVisibleConnectionIds(new Set(conns.map((c: CalendarConnection) => c.id)));
    }
    setLoading(false);
  }, [dateRange.start, dateRange.end]);

  useEffect(() => {
    setLoading(true);
    fetchData();

    const channel = supabase
      .channel("calendar-events")
      .on("postgres_changes", { event: "*", schema: "public", table: "calendar_events" }, () => fetchData())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  // Auto-sync on load (deferred) + on tab focus. Single-flight guard in
  // triggerCalendarSync means dashboard + calendar in same session sync once.
  useEffect(() => {
    let idleId: number | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    if ("requestIdleCallback" in window) {
      idleId = requestIdleCallback(() => triggerCalendarSync());
    } else {
      timeout = setTimeout(triggerCalendarSync, 1000);
    }
    // Re-sync when user returns to tab instead of polling
    const handleVisibility = () => {
      if (document.visibilityState === "visible") triggerCalendarSync();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      if (idleId !== undefined) cancelIdleCallback(idleId);
      if (timeout) clearTimeout(timeout);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  // Routine blocks for selected date
  const activeRoutine = getRoutineForDate(selectedDate, routineTemplates);
  const activeRoutineBlocks = activeRoutine
    ? routineBlocks.filter((b) => b.template_id === activeRoutine.id)
    : [];

  // Filter events
  const filteredEvents = events.filter(
    (e) => !e.connection_id || visibleConnectionIds.has(e.connection_id)
  );

  // Also include local events (no connection_id)
  const allVisibleEvents = filteredEvents;

  const toggleConnection = (id: string) => {
    setVisibleConnectionIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const goToday = () => setSelectedDate(new Date());

  const navigate = (direction: 1 | -1) => {
    const d = new Date(selectedDate);
    if (viewMode === "month") {
      d.setMonth(d.getMonth() + direction);
    } else if (viewMode === "week") {
      d.setDate(d.getDate() + direction * 7);
    } else {
      d.setDate(d.getDate() + direction);
    }
    setSelectedDate(d);
  };

  const isToday = selectedDate.toDateString() === new Date().toDateString();

  // Month view: clicking a date switches to day view for that date
  const handleMonthDateClick = (date: Date) => {
    setSelectedDate(date);
    setViewMode("day");
  };

  // Heading text
  const headingText = viewMode === "week"
    ? `${weekStart.toLocaleDateString("en-US", { month: "long", day: "numeric" })} – ${new Date(weekStart.getTime() + 6 * 86400000).toLocaleDateString("en-US", { month: "long", day: "numeric" })}`
    : formatDateHeading(selectedDate, viewMode);

  return (
    <PageLayout
      title="Calendar"
      eyebrow={`Schedule · ${headingText}`}
      icon={CalendarDays}
      loading={loading}
      maxWidth="lg"
      actions={
        <div className="flex items-center gap-2">
          {/* Add event */}
          <Button
            onClick={() => setShowCreateEvent(true)}
            variant="outline"
            size="sm"
            className="gap-1.5 h-8 rounded-lg"
          >
            <Plus className="size-3.5" />
            <span className="hidden sm:inline">Event</span>
          </Button>

          {/* View toggle */}
          <div className="flex items-center rounded-lg border border-border/50 overflow-hidden">
            <button
              onClick={() => setViewMode("day")}
              className={cn("p-1.5 transition-colors", viewMode === "day" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}
              aria-label="Day view"
            >
              <LayoutList className="size-3.5" />
            </button>
            <button
              onClick={() => setViewMode("week")}
              className={cn("p-1.5 transition-colors", viewMode === "week" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}
              aria-label="Week view"
            >
              <Grid3X3 className="size-3.5" />
            </button>
            <button
              onClick={() => setViewMode("month")}
              className={cn("p-1.5 transition-colors", viewMode === "month" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}
              aria-label="Month view"
            >
              <CalendarRange className="size-3.5" />
            </button>
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon-sm" onClick={() => navigate(-1)} className="rounded-lg" aria-label="Previous">
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant={isToday ? "default" : "outline"}
              size="sm"
              onClick={goToday}
              className={cn("rounded-lg text-xs h-8 px-3", isToday && "bg-foreground text-background hover:bg-foreground/90 border-0")}
            >
              Today
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={() => navigate(1)} className="rounded-lg" aria-label="Next">
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      }
    >
      {/* Date heading + calendar filters */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-semibold text-balance">{headingText}</h2>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Local events toggle */}
          <button
            onClick={() => {/* local events are always visible */}}
            className="flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-md text-foreground bg-card/50"
          >
            <div className="size-2.5 rounded-full bg-blue-500" />
            <span>Local</span>
          </button>
          {connections.map((conn) => {
            const isVisible = visibleConnectionIds.has(conn.id);
            return (
              <button
                key={conn.id}
                onClick={() => toggleConnection(conn.id)}
                className={cn(
                  "flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-md transition-colors",
                  isVisible ? "text-foreground bg-card/50" : "text-muted-foreground/40 line-through"
                )}
              >
                <div className={cn("size-2.5 rounded-full transition-opacity", !isVisible && "opacity-30")} style={{ backgroundColor: conn.color }} />
                <span>{conn.display_name || conn.account_email}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Views */}
      {viewMode === "month" ? (
        <MonthView
          events={allVisibleEvents}
          selectedDate={selectedDate}
          onDateClick={handleMonthDateClick}
          onEventClick={setSelectedEvent}
        />
      ) : viewMode === "week" ? (
        <WeekView events={allVisibleEvents} scheduledTasks={scheduledTasks} weekStart={weekStart} onEventClick={setSelectedEvent} />
      ) : (
        <DayTimeline events={allVisibleEvents} scheduledTasks={scheduledTasks} routineBlocks={activeRoutineBlocks} date={selectedDate} onEventClick={setSelectedEvent} />
      )}

      {/* Event detail dialog */}
      <EventDetail
        event={selectedEvent}
        open={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
      />

      {/* Create event dialog */}
      <CreateEventDialog
        open={showCreateEvent}
        onClose={() => setShowCreateEvent(false)}
        connections={connections}
        defaultDate={selectedDate}
        onCreated={fetchData}
      />
    </PageLayout>
  );
}
