"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Task, Workspace, UserSettings, Project, CalendarEvent } from "@/types/database";
import { TaskItem } from "@/components/tasks/task-item";
import { AddTaskForm } from "@/components/tasks/add-task-form";
import { EditTaskDialog } from "@/components/tasks/edit-task-dialog";
import { CapacityBar } from "@/components/dashboard/capacity-bar";
import { MorningRitual } from "@/components/planning/morning-ritual";
import { ShutdownRitual } from "@/components/planning/shutdown-ritual";
import { WelcomeFlow } from "@/components/onboarding/welcome-flow";
import { SkeletonPage } from "@/components/ui/skeleton";
import { calculateCapacityWithEvents } from "@/lib/capacity";
import { useTaskActions } from "@/lib/hooks/use-task-actions";
import { KanbanBoard } from "@/components/tasks/kanban-board";
import { ViewToggle } from "@/components/tasks/view-toggle";
import { cn } from "@/lib/utils";
import {
  Sunrise,
  Moon,
  ChevronRight,
  Filter,
  Video,
  MapPin,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const today = () => new Date().toISOString().split("T")[0];

export default function DashboardPage() {
  return (
    <Suspense fallback={<SkeletonPage />}>
      <DashboardContent />
    </Suspense>
  );
}

function DashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showBacklog, setShowBacklog] = useState(true);
  const [showCompleted, setShowCompleted] = useState(false);
  const [showRitual, setShowRitual] = useState(false);
  const [showShutdown, setShowShutdown] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [taskView, setTaskView] = useState<"list" | "kanban">("list");
  const [filterWorkspace, setFilterWorkspace] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const [{ data: ws }, { data: t }, { data: s }, { data: p }, { data: ce }] = await Promise.all([
      supabase.from("workspaces").select("*").order("name"),
      supabase.from("tasks").select("*").order("position", { ascending: true }),
      supabase.from("user_settings").select("*").limit(1).single(),
      supabase.from("projects").select("*").order("name"),
      supabase
        .from("calendar_events")
        .select("*")
        .gte("end_time", todayStart.toISOString())
        .lt("start_time", todayEnd.toISOString())
        .neq("status", "cancelled")
        .order("start_time", { ascending: true }),
    ]);
    setWorkspaces(ws || []);
    setTasks(t || []);
    setProjects(p || []);
    setSettings(s || null);
    setCalendarEvents(ce || []);
    setLoading(false);

    // Auto-expand backlog if nothing is planned for today
    const todayDate = new Date().toISOString().split("T")[0];
    const hasPlanned = (t || []).some((task) => task.planned_date === todayDate && task.status !== "done");
    if (!hasPlanned) setShowBacklog(true);
  }, []);

  useEffect(() => {
    fetchData();
    const channel = supabase
      .channel("tasks-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => fetchData())
      .subscribe();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") fetchData();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [fetchData]);

  // Auto-sync calendars on dashboard load
  useEffect(() => {
    const triggerSync = () => {
      fetch("/api/integrations/calendar/sync-all", { method: "POST" }).catch(() => {});
    };
    const timeout = setTimeout(triggerSync, 2000);
    return () => clearTimeout(timeout);
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
    (t) => t.status === "done" && t.completed_at && t.completed_at.split("T")[0] === todayStr
  );

  const backlog = filteredTasks.filter(
    (t) => t.status !== "done" && t.planned_date !== todayStr && !(t.due_date && t.due_date < todayStr)
  );

  const capacity = calculateCapacityWithEvents(tasks, calendarEvents, new Date(), settings);
  const planningDone = settings?.planning_completed_date === todayStr;
  const shutdownDone = settings?.shutdown_completed_date === todayStr;

  const { handleToggle, handleDelete, handleEdit, handleAdd: handleAddTask } = useTaskActions(tasks, fetchData);

  const handleStatusChange = async (taskId: string, newStatus: Task["status"]) => {
    await supabase.from("tasks").update({
      status: newStatus,
      completed_at: newStatus === "done" ? new Date().toISOString() : null,
    }).eq("id", taskId);
    fetchData();
  };

  if (loading) return <SkeletonPage />;

  const isNewUser = !settings;
  if (isNewUser) return <WelcomeFlow workspaces={workspaces} onComplete={fetchData} />;

  if (showRitual) {
    return (
      <MorningRitual
        tasks={tasks} workspaces={workspaces} settings={settings}
        calendarEvents={calendarEvents}
        onComplete={() => { setShowRitual(false); fetchData(); }}
        onCancel={() => setShowRitual(false)}
      />
    );
  }

  if (showShutdown) {
    return (
      <ShutdownRitual
        tasks={tasks} workspaces={workspaces} settings={settings}
        onComplete={() => { setShowShutdown(false); fetchData(); }}
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
    <div className="max-w-3xl mx-auto p-3 md:p-8 pb-24 md:pb-8 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <h1 className="text-lg font-semibold font-heading">{dateStr}</h1>
          {settings?.daily_intention && planningDone && (
            <p className="text-sm text-muted-foreground italic mt-0.5">{settings.daily_intention}</p>
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
                    style={{ backgroundColor: event.color || "#3b82f6" }}
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
                      className="shrink-0 px-2.5 py-1 rounded text-xs font-medium bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors flex items-center gap-1"
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

          {/* Planned tasks (non-focus) — includes overdue, they just have red dates */}
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
              <div className="inline-flex size-12 items-center justify-center rounded border border-primary/30" style={{ boxShadow: '0 0 12px -3px var(--hud-glow)' }}>
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
        open={!!editingTask}
        onClose={() => setEditingTask(null)}
        onSave={handleEdit}
      />
    </div>
  );
}
