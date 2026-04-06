"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { CalendarEvent, CalendarConnection, Task } from "@/types/database";
import { PageLayout } from "@/components/layout/page-layout";
import { DayTimeline } from "@/components/calendar/day-timeline";
import { WeekView } from "@/components/calendar/week-view";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CalendarDays, ChevronLeft, ChevronRight, LayoutList, Grid3X3 } from "lucide-react";

function formatDateHeading(date: Date): string {
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

  if (isToday) return `Today — ${formatted}`;
  if (isTomorrow) return `Tomorrow — ${formatted}`;
  if (isYesterday) return `Yesterday — ${formatted}`;
  return formatted;
}

export default function CalendarPage() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"day" | "week">("day");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [scheduledTasks, setScheduledTasks] = useState<Task[]>([]);
  const [connections, setConnections] = useState<CalendarConnection[]>([]);
  const [loading, setLoading] = useState(true);

  const weekStart = useMemo(() => {
    const d = new Date(selectedDate);
    const day = d.getDay();
    d.setDate(d.getDate() - day); // Sunday
    d.setHours(0, 0, 0, 0);
    return d;
  }, [selectedDate]);

  const dateStr = useMemo(() => {
    if (viewMode === "week") return weekStart.toISOString();
    const d = new Date(selectedDate);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }, [selectedDate, viewMode, weekStart]);

  const nextDateStr = useMemo(() => {
    if (viewMode === "week") {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + 7);
      return d.toISOString();
    }
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }, [selectedDate, viewMode, weekStart]);

  const fetchData = useCallback(async () => {
    const [{ data: evts }, { data: conns }, { data: tasks }] = await Promise.all([
      supabase
        .from("calendar_events")
        .select("*")
        .gte("end_time", dateStr)
        .lt("start_time", nextDateStr)
        .neq("status", "cancelled")
        .order("start_time", { ascending: true }),
      supabase
        .from("calendar_connections")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: true }),
      supabase
        .from("tasks")
        .select("*")
        .not("scheduled_start", "is", null)
        .gte("scheduled_end", dateStr)
        .lt("scheduled_start", nextDateStr)
        .neq("status", "done"),
    ]);

    setEvents(evts || []);
    setScheduledTasks(tasks || []);
    setConnections(conns || []);
    setLoading(false);
  }, [dateStr, nextDateStr]);

  useEffect(() => {
    setLoading(true);
    fetchData();

    const channel = supabase
      .channel("calendar-events")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "calendar_events" },
        () => fetchData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  const goToday = () => setSelectedDate(new Date());
  const step = viewMode === "week" ? 7 : 1;
  const goPrev = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - step);
    setSelectedDate(d);
  };
  const goNext = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + step);
    setSelectedDate(d);
  };

  const isToday =
    selectedDate.toDateString() === new Date().toDateString();

  return (
    <PageLayout
      title="Calendar"
      icon={CalendarDays}
      loading={loading}
      maxWidth="lg"
      actions={
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center rounded-lg border border-border/50 overflow-hidden">
            <button
              onClick={() => setViewMode("day")}
              className={cn(
                "p-1.5 transition-colors",
                viewMode === "day"
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              )}
              aria-label="Day view"
            >
              <LayoutList className="size-3.5" />
            </button>
            <button
              onClick={() => setViewMode("week")}
              className={cn(
                "p-1.5 transition-colors",
                viewMode === "week"
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              )}
              aria-label="Week view"
            >
              <Grid3X3 className="size-3.5" />
            </button>
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={goPrev}
              className="rounded-lg"
              aria-label={viewMode === "week" ? "Previous week" : "Previous day"}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant={isToday ? "default" : "outline"}
              size="sm"
              onClick={goToday}
              className={cn(
                "rounded-lg text-xs h-8 px-3",
                isToday && "bg-foreground text-background hover:bg-foreground/90 border-0"
              )}
            >
              Today
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={goNext}
              className="rounded-lg"
              aria-label={viewMode === "week" ? "Next week" : "Next day"}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      }
    >
      {/* Date heading */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-balance">
          {viewMode === "week"
            ? `${weekStart.toLocaleDateString("en-US", { month: "long", day: "numeric" })} – ${new Date(weekStart.getTime() + 6 * 86400000).toLocaleDateString("en-US", { month: "long", day: "numeric" })}`
            : formatDateHeading(selectedDate)}
        </h2>
        <div className="flex items-center gap-3">
          {connections.map((conn) => (
            <div
              key={conn.id}
              className="flex items-center gap-1.5 text-[11px] text-muted-foreground"
            >
              <div
                className="size-2.5 rounded-full"
                style={{ backgroundColor: conn.color }}
              />
              <span>{conn.display_name || conn.account_email}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Timeline */}
      {connections.length === 0 && !loading ? (
        <div className="text-center py-20">
          <CalendarDays className="size-8 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground text-pretty">
            No calendars connected yet
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1 text-pretty">
            Go to Settings → Calendar Feeds to add your ICS feed URLs
          </p>
        </div>
      ) : viewMode === "week" ? (
        <WeekView events={events} scheduledTasks={scheduledTasks} weekStart={weekStart} />
      ) : (
        <DayTimeline events={events} scheduledTasks={scheduledTasks} date={selectedDate} />
      )}
    </PageLayout>
  );
}
