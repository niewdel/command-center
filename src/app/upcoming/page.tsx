"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Task, Workspace, Project, CalendarEvent } from "@/types/database";
import { TaskItem } from "@/components/tasks/task-item";
import { EditTaskDialog } from "@/components/tasks/edit-task-dialog";
import { EventDetail } from "@/components/calendar/event-detail";
import { cn } from "@/lib/utils";
import { PageLayout } from "@/components/layout/page-layout";
import { CalendarDays, Video, MapPin, Clock } from "lucide-react";

function getDateStr(offset: number) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().split("T")[0];
}

function formatDayLabel(dateStr: string) {
  const today = getDateStr(0);
  const tomorrow = getDateStr(1);
  if (dateStr === today) return "Today";
  if (dateStr === tomorrow) return "Tomorrow";
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

type DayForecast = {
  date: string;
  high: number;
  low: number;
  code: number;
};

function weatherCodeToIcon(code: number): string {
  if (code === 0) return "☀️";
  if (code <= 3) return "⛅";
  if (code <= 48) return "🌫️";
  if (code <= 57) return "🌧️";
  if (code <= 67) return "🌧️";
  if (code <= 77) return "❄️";
  if (code <= 86) return "🌨️";
  if (code >= 95) return "⛈️";
  return "☁️";
}

function weatherCodeToAlert(code: number): string | null {
  if (code >= 95) return "Thunderstorms";
  if (code >= 71 && code <= 77) return "Snow";
  if (code >= 66 && code <= 67) return "Freezing rain";
  if (code >= 61 && code <= 65) return "Rain";
  return null;
}

export default function UpcomingPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [forecast, setForecast] = useState<DayForecast[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date();
    weekEnd.setDate(weekEnd.getDate() + 7);
    weekEnd.setHours(23, 59, 59, 999);

    const [{ data: t }, { data: w }, { data: p }, { data: ce }] =
      await Promise.all([
        supabase
          .from("tasks")
          .select("*")
          .neq("status", "done")
          .order("position", { ascending: true }),
        supabase.from("workspaces").select("*").order("name"),
        supabase.from("projects").select("*").order("name"),
        supabase
          .from("calendar_events")
          .select("*")
          .gte("end_time", todayStart.toISOString())
          .lte("start_time", weekEnd.toISOString())
          .neq("status", "cancelled")
          .order("start_time", { ascending: true }),
      ]);
    setTasks(t || []);
    setWorkspaces(w || []);
    setProjects(p || []);
    setCalendarEvents(ce || []);
    setLoading(false);
  }, []);

  // Fetch 7-day weather forecast
  useEffect(() => {
    const fetchForecast = async () => {
      try {
        const res = await fetch(
          "https://api.open-meteo.com/v1/forecast?latitude=35.2271&longitude=-80.8431&daily=temperature_2m_max,temperature_2m_min,weather_code&temperature_unit=fahrenheit&timezone=America%2FNew_York&forecast_days=7"
        );
        const data = await res.json();
        if (data.daily) {
          const days: DayForecast[] = data.daily.time.map(
            (date: string, i: number) => ({
              date,
              high: Math.round(data.daily.temperature_2m_max[i]),
              low: Math.round(data.daily.temperature_2m_min[i]),
              code: data.daily.weather_code[i],
            })
          );
          setForecast(days);
        }
      } catch {
        // Weather is nice-to-have
      }
    };
    fetchForecast();
  }, []);

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel("upcoming-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks" },
        () => fetchData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  const workspaceMap = Object.fromEntries(
    workspaces.map((w) => [w.id, w])
  );
  const projectMap = Object.fromEntries(projects.map((p) => [p.id, p]));

  // Build 7-day view
  const days = Array.from({ length: 7 }, (_, i) => getDateStr(i));
  const today = getDateStr(0);

  // Group tasks by planned_date or due_date
  const tasksByDay = new Map<string, Task[]>();
  for (const day of days) {
    tasksByDay.set(day, []);
  }
  for (const task of tasks) {
    const taskDate = task.planned_date || task.due_date;
    if (taskDate && tasksByDay.has(taskDate)) {
      tasksByDay.get(taskDate)!.push(task);
    } else if (taskDate && taskDate >= today && taskDate <= days[6]) {
      const closest = days.find((d) => d >= taskDate) || days[6];
      tasksByDay.get(closest)?.push(task);
    }
  }

  // Group calendar events by day
  const eventsByDay = new Map<string, CalendarEvent[]>();
  for (const day of days) {
    eventsByDay.set(day, []);
  }
  for (const event of calendarEvents) {
    const eventDate = new Date(event.start_time).toISOString().split("T")[0];
    if (eventsByDay.has(eventDate)) {
      eventsByDay.get(eventDate)!.push(event);
    }
  }

  // Overdue
  const overdue = tasks.filter(
    (t) =>
      (t.due_date && t.due_date < today) ||
      (t.planned_date && t.planned_date < today)
  );

  // Forecast map
  const forecastMap = new Map(forecast.map((f) => [f.date, f]));

  const handleToggle = async (id: string, done: boolean) => {
    await supabase
      .from("tasks")
      .update({
        status: done ? "done" : "todo",
        completed_at: done ? new Date().toISOString() : null,
      })
      .eq("id", id);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("tasks").delete().eq("id", id);
    fetchData();
  };

  const handleEdit = async (id: string, updates: Partial<Task>) => {
    await supabase.from("tasks").update(updates).eq("id", id);
    fetchData();
  };

  return (
    <PageLayout
      title="This Week"
      description="Your next 7 days at a glance."
      icon={CalendarDays}
      loading={loading}
    >
      {/* Weekly weather bar */}
      {forecast.length > 0 && (
        <div className="flex gap-1 overflow-x-auto pb-1">
          {forecast.map((f) => {
            const isToday = f.date === today;
            const alert = weatherCodeToAlert(f.code);
            return (
              <div
                key={f.date}
                className={cn(
                  "flex-1 min-w-[72px] rounded-lg border px-2 py-2 text-center",
                  isToday
                    ? "border-primary/30 bg-primary/5"
                    : "border-border/30 bg-card/20"
                )}
              >
                <div className="text-[10px] text-muted-foreground uppercase">
                  {new Date(f.date + "T12:00:00").toLocaleDateString("en-US", {
                    weekday: "short",
                  })}
                </div>
                <div className="text-base mt-0.5">
                  {weatherCodeToIcon(f.code)}
                </div>
                <div className="text-xs font-medium tabular-nums mt-0.5">
                  {f.high}° / {f.low}°
                </div>
                {alert && (
                  <div className="text-[9px] text-amber-400 font-medium mt-0.5 truncate">
                    {alert}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Overdue */}
      {overdue.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs font-semibold text-red-400 uppercase text-balance font-heading">
            Overdue
          </h2>
          <div className="space-y-2">
            {overdue.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                workspace={workspaceMap[task.workspace_id]}
                project={
                  task.project_id
                    ? projectMap[task.project_id]
                    : undefined
                }
                onToggle={handleToggle}
                onDelete={handleDelete}
                onEdit={setEditingTask}
              />
            ))}
          </div>
        </div>
      )}

      {/* 7-day view */}
      {days.map((day) => {
        const dayTasks = tasksByDay.get(day) || [];
        const dayEvents = eventsByDay.get(day) || [];
        const isToday = day === today;
        const dayForecast = forecastMap.get(day);
        const hasContent = dayTasks.length > 0 || dayEvents.length > 0;

        return (
          <div key={day} className="space-y-3">
            <div className="flex items-center justify-between">
              <h2
                className={cn(
                  "text-xs font-medium uppercase text-balance font-heading",
                  isToday ? "text-primary" : "text-muted-foreground"
                )}
              >
                {formatDayLabel(day)}
                {hasContent && (
                  <span className="ml-2 text-muted-foreground font-normal">
                    ({dayEvents.length > 0 ? `${dayEvents.length} event${dayEvents.length !== 1 ? "s" : ""}` : ""}
                    {dayEvents.length > 0 && dayTasks.length > 0 ? ", " : ""}
                    {dayTasks.length > 0 ? `${dayTasks.length} task${dayTasks.length !== 1 ? "s" : ""}` : ""})
                  </span>
                )}
              </h2>
              {dayForecast && (
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  {weatherCodeToIcon(dayForecast.code)} {dayForecast.high}°/{dayForecast.low}°
                </span>
              )}
            </div>

            {/* Calendar events for this day */}
            {dayEvents.length > 0 && (
              <div className="space-y-1">
                {dayEvents
                  .filter((e) => !e.all_day)
                  .map((event) => (
                    <button
                      key={event.id}
                      onClick={() => setSelectedEvent(event)}
                      className="w-full flex items-center gap-3 rounded-lg border border-border/30 bg-card/30 px-3 py-2 text-left hover:bg-card/50 transition-colors"
                    >
                      <div
                        className="w-0.5 h-7 rounded-full shrink-0"
                        style={{
                          backgroundColor: event.color || "#3b82f6",
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {event.title}
                        </p>
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                          <span className="flex items-center gap-1 tabular-nums">
                            <Clock className="size-2.5" />
                            {new Date(
                              event.start_time
                            ).toLocaleTimeString("en-US", {
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                            {" – "}
                            {new Date(
                              event.end_time
                            ).toLocaleTimeString("en-US", {
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </span>
                          {event.location && (
                            <span className="flex items-center gap-1 truncate max-w-[150px]">
                              <MapPin className="size-2.5 shrink-0" />
                              {event.location}
                            </span>
                          )}
                        </div>
                      </div>
                      {event.meeting_url && (
                        <a
                          href={event.meeting_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="shrink-0 px-2 py-1 rounded text-xs font-medium bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors flex items-center gap-1"
                        >
                          <Video className="size-3" />
                          Join
                        </a>
                      )}
                    </button>
                  ))}
              </div>
            )}

            {/* Tasks for this day */}
            {dayTasks.length > 0 ? (
              <div className="space-y-2">
                {dayTasks.map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    workspace={workspaceMap[task.workspace_id]}
                    onToggle={handleToggle}
                    onDelete={handleDelete}
                    onEdit={setEditingTask}
                  />
                ))}
              </div>
            ) : dayEvents.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border/40 bg-card/20 p-4 text-center">
                <p className="text-xs text-muted-foreground/60 text-pretty">
                  Nothing planned
                </p>
              </div>
            ) : null}
          </div>
        );
      })}

      <EditTaskDialog
        task={editingTask}
        workspaces={workspaces}
        projects={projects}
        open={!!editingTask}
        onClose={() => setEditingTask(null)}
        onSave={handleEdit}
      />

      <EventDetail
        event={selectedEvent}
        open={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
      />
    </PageLayout>
  );
}
