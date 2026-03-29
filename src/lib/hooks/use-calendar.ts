"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { CalendarEvent } from "@/types/database";

export type CalendarView = "day" | "week" | "month";

export function useCalendar() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<CalendarView>("week");

  const getDateRange = useCallback(() => {
    const start = new Date(currentDate);
    const end = new Date(currentDate);

    if (view === "day") {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (view === "week") {
      const day = start.getDay();
      start.setDate(start.getDate() - day);
      start.setHours(0, 0, 0, 0);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
    } else {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(end.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
    }

    return { start, end };
  }, [currentDate, view]);

  const fetchEvents = useCallback(async () => {
    const { start, end } = getDateRange();

    const { data, error } = await supabase
      .from("calendar_events")
      .select("*")
      .gte("start_time", start.toISOString())
      .lte("start_time", end.toISOString())
      .neq("status", "cancelled")
      .order("start_time", { ascending: true });

    if (!error && data) {
      setEvents(data as CalendarEvent[]);
    }
    setLoading(false);
  }, [getDateRange]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("calendar_events_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "calendar_events" },
        () => {
          fetchEvents();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchEvents]);

  const navigateDate = useCallback(
    (direction: "prev" | "next" | "today") => {
      if (direction === "today") {
        setCurrentDate(new Date());
        return;
      }

      const delta = direction === "next" ? 1 : -1;
      setCurrentDate((prev) => {
        const next = new Date(prev);
        if (view === "day") {
          next.setDate(next.getDate() + delta);
        } else if (view === "week") {
          next.setDate(next.getDate() + delta * 7);
        } else {
          next.setMonth(next.getMonth() + delta);
        }
        return next;
      });
    },
    [view]
  );

  const createEvent = async (event: Partial<CalendarEvent>) => {
    const { data: user } = await supabase.auth.getUser();
    if (!user?.user) return null;

    const { data, error } = await supabase
      .from("calendar_events")
      .insert({
        user_id: user.user.id,
        title: event.title || "New Event",
        start_time: event.start_time,
        end_time: event.end_time,
        location: event.location || null,
        description: event.description || null,
        workspace_id: event.workspace_id || null,
        all_day: event.all_day || false,
        meeting_url: event.meeting_url || null,
        meeting_provider: event.meeting_provider || null,
        source: "local",
      })
      .select()
      .single();

    if (error) {
      console.error("Create event error:", error);
      return null;
    }
    return data;
  };

  const updateEvent = async (id: string, updates: Partial<CalendarEvent>) => {
    const { error } = await supabase
      .from("calendar_events")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) console.error("Update event error:", error);
  };

  const deleteEvent = async (id: string) => {
    const { error } = await supabase
      .from("calendar_events")
      .delete()
      .eq("id", id);

    if (error) console.error("Delete event error:", error);
  };

  return {
    events,
    loading,
    currentDate,
    view,
    setView,
    navigateDate,
    createEvent,
    updateEvent,
    deleteEvent,
    getDateRange,
    refetch: fetchEvents,
  };
}
