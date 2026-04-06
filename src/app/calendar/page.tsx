"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { CalendarEvent, CalendarConnection } from "@/types/database";
import { PageLayout } from "@/components/layout/page-layout";
import { DayTimeline } from "@/components/calendar/day-timeline";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

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
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [connections, setConnections] = useState<CalendarConnection[]>([]);
  const [loading, setLoading] = useState(true);

  const dateStr = useMemo(() => {
    const d = new Date(selectedDate);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }, [selectedDate]);

  const nextDateStr = useMemo(() => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }, [selectedDate]);

  const fetchData = useCallback(async () => {
    const [{ data: evts }, { data: conns }] = await Promise.all([
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
    ]);

    setEvents(evts || []);
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
  const goPrev = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(d);
  };
  const goNext = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
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
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={goPrev}
            className="rounded-lg"
            aria-label="Previous day"
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
            aria-label="Next day"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      }
    >
      {/* Date heading */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-balance">
          {formatDateHeading(selectedDate)}
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
      ) : (
        <DayTimeline events={events} date={selectedDate} />
      )}
    </PageLayout>
  );
}
