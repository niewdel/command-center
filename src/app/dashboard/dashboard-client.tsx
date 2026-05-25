"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  Task,
  Workspace,
  UserSettings,
  Project,
  CalendarEvent,
  RoutineTemplate,
  RoutineBlock,
  Expense,
  Goal,
} from "@/types/database";
import { getUpcomingExpenses, formatDaysUntil } from "@/lib/expenses";
import {
  getRoutineForDate,
  getNextRoutineBlock,
  formatRoutineTime,
} from "@/lib/routines";
import { TaskItem } from "@/components/tasks/task-item";
import { AddTaskForm } from "@/components/tasks/add-task-form";
import { EditTaskDialog } from "@/components/tasks/edit-task-dialog";
import { CapacityBar } from "@/components/dashboard/capacity-bar";
import { MorningRitual } from "@/components/planning/morning-ritual";
import { ShutdownRitual } from "@/components/planning/shutdown-ritual";
import { WelcomeFlow } from "@/components/onboarding/welcome-flow";
import { calculateCapacityWithEvents } from "@/lib/capacity";
import { useTaskActions } from "@/lib/hooks/use-task-actions";
import { KanbanBoard } from "@/components/tasks/kanban-board";
import { ViewToggle } from "@/components/tasks/view-toggle";
import { cn, localDateString } from "@/lib/utils";
import { useRealtime } from "@/lib/providers/realtime-provider";
import { triggerCalendarSync } from "@/lib/calendar-sync";
import {
  Sunrise,
  Moon,
  ChevronRight,
  Filter,
  Video,
  MapPin,
  Clock,
  DollarSign,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const today = () => localDateString();

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 21) return "Good evening";
  return "Good night";
}

function weatherCodeToDescription(code: number): string {
  if (code === 0) return "Clear";
  if (code <= 3) return "Partly cloudy";
  if (code <= 48) return "Foggy";
  if (code <= 57) return "Drizzle";
  if (code <= 65) return "Rain";
  if (code <= 67) return "Freezing rain";
  if (code <= 77) return "Snow";
  if (code <= 82) return "Showers";
  if (code <= 86) return "Snow showers";
  if (code >= 95) return "Thunderstorm";
  return "Cloudy";
}

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

type Props = {
  initialWorkspaces: Workspace[];
  initialTasks: Task[];
  initialSettings: UserSettings | null;
  initialProjects: Project[];
  initialCalendarEvents: CalendarEvent[];
  initialRoutineTemplates: RoutineTemplate[];
  initialRoutineBlocks: RoutineBlock[];
  initialExpenses: Expense[];
  initialGoals: Goal[];
};

export function DashboardClient(props: Props) {
  return (
    <Suspense fallback={null}>
      <DashboardContent {...props} />
    </Suspense>
  );
}

function DashboardContent({
  initialWorkspaces,
  initialTasks,
  initialSettings,
  initialProjects,
  initialCalendarEvents,
  initialRoutineTemplates,
  initialRoutineBlocks,
  initialExpenses,
  initialGoals,
}: Props) {
  const searchParams = useSearchParams();
  const router = useRouter();
  // Tasks are the only piece that needs in-memory mutation (optimistic edits,
  // toggle, delete). Everything else can come straight from props and refresh
  // via router.refresh() on realtime change. Keeping tasks as state lets the
  // existing useTaskActions hook continue to do optimistic UI without making
  // the user wait for a server roundtrip.
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  useEffect(() => setTasks(initialTasks), [initialTasks]);

  const workspaces = initialWorkspaces;
  const settings = initialSettings;
  const projects = initialProjects;
  const calendarEvents = initialCalendarEvents;
  const routineTemplates = initialRoutineTemplates;
  const routineBlocks = initialRoutineBlocks;
  const expenses = initialExpenses;
  const goals = initialGoals;

  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showBacklog, setShowBacklog] = useState(true);
  const [showCompleted, setShowCompleted] = useState(false);
  const [showRitual, setShowRitual] = useState(false);
  const [showShutdown, setShowShutdown] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [taskView, setTaskView] = useState<"list" | "kanban">("list");
  const [filterWorkspace, setFilterWorkspace] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [weather, setWeather] = useState<{ temp: number; description: string; icon: string } | null>(null);

  // Fetch weather (Charlotte, NC, Open-Meteo, no API key needed), cached 1 hour
  useEffect(() => {
    const CACHE_KEY = "cc-weather";
    const CACHE_TTL = 60 * 60 * 1000; // 1 hour
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        const { data: w, ts } = JSON.parse(cached);
        if (Date.now() - ts < CACHE_TTL) { setWeather(w); return; }
      } catch { /* ignore bad cache */ }
    }
    const fetchWeather = async () => {
      try {
        const res = await fetch(
          "https://api.open-meteo.com/v1/forecast?latitude=35.2271&longitude=-80.8431&current=temperature_2m,weather_code&temperature_unit=fahrenheit&timezone=America%2FNew_York"
        );
        const data = await res.json();
        const code = data.current?.weather_code ?? 0;
        const temp = Math.round(data.current?.temperature_2m ?? 0);
        const desc = weatherCodeToDescription(code);
        const icon = weatherCodeToIcon(code);
        const w = { temp, description: desc, icon };
        setWeather(w);
        localStorage.setItem(CACHE_KEY, JSON.stringify({ data: w, ts: Date.now() }));
      } catch {
        // Weather is nice to have, not critical
      }
    };
    fetchWeather();
  }, []);

  const refresh = useCallback(() => router.refresh(), [router]);

  // Realtime: when any task changes, ask Next to re-render the Server
  // Component (router.refresh) so the page picks up new data without
  // losing client state. Underlying subscription is shared with any other
  // page on the same table via the RealtimeProvider.
  useRealtime("tasks", refresh);

  // Lightweight refetch for optimistic edits, hits the client and only
  // updates the tasks slice. Keeps task interactions feeling instant.
  const refetchTasks = useCallback(async () => {
    const { data: t } = await supabase
      .from("tasks")
      .select("*")
      .order("position", { ascending: true });
    setTasks(t || []);
  }, []);

  // On tab focus, ask Next to re-render server-side data.
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [refresh]);

  // Auto-sync calendars on dashboard load (deferred), guarded against
  // double-fire if the user also visits /calendar in the same session.
  useEffect(() => {
    if ("requestIdleCallback" in window) {
      const id = requestIdleCallback(() => triggerCalendarSync());
      return () => cancelIdleCallback(id);
    } else {
      const timeout = setTimeout(triggerCalendarSync, 1000);
      return () => clearTimeout(timeout);
    }
  }, []);

  useEffect(() => {
    const taskId = searchParams.get("task");
    if (taskId && tasks.length > 0) {
      const task = tasks.find((t) => t.id === taskId);
      if (task) {
        setEditingTask(task);
        router.replace("/dashboard", { scroll: false });
      }
    }
  }, [searchParams, tasks, router]);

  const workspaceMap = Object.fromEntries(workspaces.map((w) => [w.id, w]));
  const projectMap = Object.fromEntries(projects.map((p) => [p.id, p]));
  const todayStr = today();
  const hasActiveFilters = filterWorkspace !== "all" || filterPriority !== "all";

  const applyFilters = (taskList: Task[]) => {
    let filtered = taskList;
    if (filterWorkspace !== "all") filtered = filtered.filter((t) => t.workspace_id === filterWorkspace);
    if (filterPriority !== "all") filtered = filtered.filter((t) => t.priority === filterPriority);
    return filtered;
  };

  const filteredTasks = applyFilters(tasks);

  const plannedToday = filteredTasks
    .filter((t) => t.planned_date === todayStr && t.status !== "done")
    .sort((a, b) => {
      if (a.is_focus && !b.is_focus) return -1;
      if (!a.is_focus && b.is_focus) return 1;
      return (a.position || 0) - (b.position || 0);
    });

  const focusTasks = plannedToday.filter((t) => t.is_focus);
  const nonFocusPlanned = plannedToday.filter((t) => !t.is_focus);

  const overdueTasks = filteredTasks.filter(
    (t) => t.due_date && t.due_date < todayStr && t.status !== "done"
  );

  const completedToday = filteredTasks.filter(
    (t) =>
      t.status === "done" &&
      t.completed_at &&
      localDateString(new Date(t.completed_at)) === todayStr
  );

  const backlog = filteredTasks.filter(
    (t) => t.status !== "done" && t.planned_date !== todayStr && !(t.due_date && t.due_date < todayStr)
  );

  // Compute routine info
  const todayRoutine = getRoutineForDate(new Date(), routineTemplates);
  const todayRoutineBlocks = todayRoutine
    ? routineBlocks.filter((b) => b.template_id === todayRoutine.id)
    : [];
  const nextBlock = getNextRoutineBlock(todayRoutineBlocks);

  const capacity = calculateCapacityWithEvents(tasks, calendarEvents, new Date(), settings);
  const planningDone = settings?.planning_completed_date === todayStr;
  const shutdownDone = settings?.shutdown_completed_date === todayStr;

  const { handleToggle, handleDelete, handleEdit, handleAdd: handleAddTask } =
    useTaskActions(tasks, refetchTasks);

  const handleStatusChange = async (taskId: string, newStatus: Task["status"]) => {
    await supabase.from("tasks").update({
      status: newStatus,
      completed_at: newStatus === "done" ? new Date().toISOString() : null,
    }).eq("id", taskId);
    refetchTasks();
  };

  const isNewUser = !settings;
  if (isNewUser) return <WelcomeFlow workspaces={workspaces} onComplete={refresh} />;

  if (showRitual) {
    return (
      <MorningRitual
        tasks={tasks} workspaces={workspaces} settings={settings}
        calendarEvents={calendarEvents}
        onComplete={() => { setShowRitual(false); refresh(); }}
        onCancel={() => setShowRitual(false)}
      />
    );
  }

  if (showShutdown) {
    return (
      <ShutdownRitual
        tasks={tasks} workspaces={workspaces} settings={settings}
        onComplete={() => { setShowShutdown(false); refresh(); }}
        onCancel={() => setShowShutdown(false)}
      />
    );
  }

  const dateStr = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  // All planned tasks: overdue mixed in with planned, focus first
  const allTodayTasks = [...overdueTasks.filter((t) => !plannedToday.includes(t)), ...plannedToday];

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-10 pb-24 md:pb-10 space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between gap-4 pt-2">
        <div className="space-y-2 min-w-0">
          <span className="mono-tag">{dateStr}</span>
          <h1 className="text-2xl md:text-3xl font-bold font-heading text-balance tracking-tight">
            {getGreeting()}, Justin.
          </h1>
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-muted-foreground">
            {weather && (
              <span>{weather.icon} {weather.temp}°F {weather.description}</span>
            )}
            {weather && nextBlock && <span className="text-border">·</span>}
            {nextBlock && (
              <span>
                {nextBlock.icon} {nextBlock.label} at {formatRoutineTime(nextBlock.start_time)}
              </span>
            )}
          </div>
          {settings?.daily_intention && planningDone && (
            <p className="text-sm text-muted-foreground/80 italic max-w-[55ch]">
              &ldquo;{settings.daily_intention}&rdquo;
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <ViewToggle view={taskView} onChange={setTaskView} />
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "p-2 rounded-md text-muted-foreground hover:text-foreground transition-colors",
              hasActiveFilters && "text-primary"
            )}
            aria-label="Toggle filters"
          >
            <Filter className="size-4" />
          </button>
          {!planningDone && (
            <Button onClick={() => setShowRitual(true)} size="sm" className="gap-1.5 h-8 bg-primary hover:bg-primary/90 text-primary-foreground">
              <Sunrise className="size-3.5" />
              Plan
            </Button>
          )}
          {planningDone && !shutdownDone && (
            <Button onClick={() => setShowShutdown(true)} variant="ghost" size="sm" className="gap-1.5 h-8 text-muted-foreground">
              <Moon className="size-3.5" />
              Shutdown
            </Button>
          )}
        </div>
      </div>

      {/* Filters (collapsible) */}
      {showFilters && (
        <div className="flex items-center gap-1.5 flex-wrap text-xs py-1">
          {[{ id: "all", label: "All" }, ...workspaces.map((ws) => ({ id: ws.id, label: ws.name }))].map((item) => (
            <button
              key={item.id}
              onClick={() => setFilterWorkspace(item.id)}
              className={cn(
                "px-2.5 py-1.5 rounded transition-colors",
                filterWorkspace === item.id
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              )}
            >
              {item.label}
            </button>
          ))}
          <span className="text-border mx-1">·</span>
          {["all", "high", "medium", "low"].map((p) => (
            <button
              key={p}
              onClick={() => setFilterPriority(p)}
              className={cn(
                "px-2.5 py-1.5 rounded transition-colors capitalize",
                filterPriority === p
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              )}
            >
              {p === "all" ? "Any" : p}
            </button>
          ))}
          {hasActiveFilters && (
            <button
              onClick={() => { setFilterWorkspace("all"); setFilterPriority("all"); }}
              className="px-2 py-1 text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {/* Capacity bar */}
      {(plannedToday.length > 0 || calendarEvents.length > 0) && <CapacityBar capacity={capacity} />}

      {/* Upcoming events */}
      {calendarEvents.filter((e) => !e.all_day && new Date(e.end_time) > new Date()).length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-medium text-muted-foreground uppercase">
            Upcoming
          </h3>
          <div className="space-y-1.5">
            {calendarEvents
              .filter((e) => !e.all_day && new Date(e.end_time) > new Date())
              .slice(0, 4)
              .map((event) => (
                <div
                  key={event.id}
                  className="flex items-center gap-3 rounded-lg border border-border/30 bg-card/30 px-3 py-2"
                >
                  <div
                    className="w-0.5 h-8 rounded-full shrink-0"
                    style={{ backgroundColor: event.color || "var(--rust)" }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{event.title}</p>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1 tabular-nums">
                        <Clock className="size-2.5" />
                        {new Date(event.start_time).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                        {" – "}
                        {new Date(event.end_time).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
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
                      className="shrink-0 px-2.5 py-1 rounded text-xs font-medium bg-foreground/8 text-foreground hover:bg-foreground/12 transition-colors flex items-center gap-1"
                    >
                      <Video className="size-3" />
                      Join
                    </a>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Upcoming payments */}
      {(() => {
        const upcoming = getUpcomingExpenses(expenses, 7);
        if (upcoming.length === 0) return null;
        return (
          <div className="space-y-2">
            <h3 className="text-xs font-medium text-muted-foreground uppercase flex items-center gap-1.5">
              <DollarSign className="size-3" />
              Upcoming Payments
            </h3>
            <div className="space-y-1">
              {upcoming.map((exp) => (
                <div
                  key={exp.id}
                  className="flex items-center gap-3 rounded-lg border border-border/30 bg-card/30 px-3 py-2"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{exp.name}</p>
                    <span className="text-[11px] text-amber-400">
                      {exp.next_payment_date && formatDaysUntil(exp.next_payment_date)}
                    </span>
                  </div>
                  <span className="text-sm font-mono tabular-nums font-medium shrink-0">
                    ${typeof exp.cost === "string" ? parseFloat(exp.cost).toFixed(2) : exp.cost.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Task list or Kanban */}
      {taskView === "kanban" ? (
        <>
          <KanbanBoard
            tasks={filteredTasks}
            workspaceMap={workspaceMap}
            onStatusChange={handleStatusChange}
            onEdit={setEditingTask}
          />
          <AddTaskForm workspaces={workspaces} planForToday onAdd={handleAddTask} />
        </>
      ) : (
        <div className="space-y-1">
          {/* Focus tasks */}
          {focusTasks.length > 0 && (
            <>
              <p className="text-[11px] font-medium uppercase text-muted-foreground pt-2 pb-1">Focus</p>
              {focusTasks.map((task) => (
                <TaskItem
                  key={task.id} task={task} workspace={workspaceMap[task.workspace_id]} project={task.project_id ? projectMap[task.project_id] : undefined}
                  onToggle={handleToggle} onDelete={handleDelete} onEdit={setEditingTask}
                />
              ))}
            </>
          )}

          {/* Planned tasks (non-focus), includes overdue */}
          {(nonFocusPlanned.length > 0 || overdueTasks.length > 0) && (
            <>
              <p className="text-[11px] font-medium uppercase text-muted-foreground pt-3 pb-1">
                {focusTasks.length > 0 ? "Planned" : "Today"}
              </p>
              {overdueTasks.filter((t) => !focusTasks.includes(t) && !nonFocusPlanned.includes(t)).map((task) => (
                <TaskItem
                  key={task.id} task={task} workspace={workspaceMap[task.workspace_id]} project={task.project_id ? projectMap[task.project_id] : undefined}
                  onToggle={handleToggle} onDelete={handleDelete} onEdit={setEditingTask}
                />
              ))}
              {nonFocusPlanned.map((task) => (
                <TaskItem
                  key={task.id} task={task} workspace={workspaceMap[task.workspace_id]} project={task.project_id ? projectMap[task.project_id] : undefined}
                  onToggle={handleToggle} onDelete={handleDelete} onEdit={setEditingTask}
                />
              ))}
            </>
          )}

          {/* Empty state */}
          {allTodayTasks.length === 0 && (
            <div className="text-center py-20 space-y-3">
              <div className="inline-flex size-12 items-center justify-center rounded border border-primary/30">
                <Sunrise className="size-5 text-primary" />
              </div>
              <p className="text-sm font-medium">Clear schedule today</p>
              <p className="text-xs text-muted-foreground max-w-[240px] mx-auto">Start your morning ritual to plan your day, or add a task below.</p>
              {!planningDone && (
                <Button
                  onClick={() => setShowRitual(true)}
                  size="sm"
                  className="gap-1.5 h-8 bg-primary hover:bg-primary/90 text-primary-foreground mt-2"
                >
                  <Sunrise className="size-3.5" />
                  Plan My Day
                </Button>
              )}
            </div>
          )}

          {/* Add task */}
          <div className="pt-2">
            <AddTaskForm workspaces={workspaces} planForToday onAdd={handleAddTask} />
          </div>

          {/* Completed today */}
          {completedToday.length > 0 && (
            <div className="pt-3">
              <button
                onClick={() => setShowCompleted(!showCompleted)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
              >
                <ChevronRight className={cn("size-3 transition-transform", showCompleted && "rotate-90")} />
                Completed today ({completedToday.length})
              </button>
              {showCompleted && (
                <div className="mt-1">
                  {completedToday.map((task) => (
                    <TaskItem
                      key={task.id} task={task} workspace={workspaceMap[task.workspace_id]} project={task.project_id ? projectMap[task.project_id] : undefined}
                      onToggle={handleToggle} onDelete={handleDelete} onEdit={setEditingTask}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Backlog */}
          {backlog.length > 0 && (
            <div className="pt-1">
              <button
                onClick={() => setShowBacklog(!showBacklog)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
              >
                <ChevronRight className={cn("size-3 transition-transform", showBacklog && "rotate-90")} />
                Backlog ({backlog.length})
              </button>
              {showBacklog && (
                <div className="mt-1">
                  {backlog.map((task) => (
                    <TaskItem
                      key={task.id} task={task} workspace={workspaceMap[task.workspace_id]} project={task.project_id ? projectMap[task.project_id] : undefined}
                      onToggle={handleToggle} onDelete={handleDelete} onEdit={setEditingTask}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Edit dialog */}
      <EditTaskDialog
        task={editingTask}
        workspaces={workspaces}
        projects={projects}
        goals={goals}
        open={!!editingTask}
        onClose={() => setEditingTask(null)}
        onSave={handleEdit}
      />
    </div>
  );
}
