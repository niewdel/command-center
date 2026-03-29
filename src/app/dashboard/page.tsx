"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Task, Workspace, UserSettings } from "@/types/database";
import { TaskItem } from "@/components/tasks/task-item";
import { AddTaskForm } from "@/components/tasks/add-task-form";
import { EditTaskDialog } from "@/components/tasks/edit-task-dialog";
import { CapacityBar } from "@/components/dashboard/capacity-bar";
import { MorningRitual } from "@/components/planning/morning-ritual";
import { ShutdownRitual } from "@/components/planning/shutdown-ritual";
import { WelcomeFlow } from "@/components/onboarding/welcome-flow";
import { calculateCapacity } from "@/lib/capacity";
import { useTaskActions } from "@/lib/hooks/use-task-actions";
import { KanbanBoard } from "@/components/tasks/kanban-board";
import { ViewToggle } from "@/components/tasks/view-toggle";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  CheckCircle2,
  ListTodo,
  Sunrise,
  Moon,
  Star,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const today = () => new Date().toISOString().split("T")[0];

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex items-center gap-3 text-muted-foreground">
          <div className="h-5 w-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <span className="text-sm">Loading...</span>
        </div>
      </div>
    }>
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
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showAllTasks, setShowAllTasks] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [showRitual, setShowRitual] = useState(false);
  const [showShutdown, setShowShutdown] = useState(false);
  const [taskView, setTaskView] = useState<"list" | "kanban">("list");
  const [filterWorkspace, setFilterWorkspace] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const [{ data: ws }, { data: t }, { data: s }] = await Promise.all([
      supabase.from("workspaces").select("*").order("name"),
      supabase
        .from("tasks")
        .select("*")
        .order("position", { ascending: true }),
      supabase.from("user_settings").select("*").limit(1).single(),
    ]);
    setWorkspaces(ws || []);
    setTasks(t || []);
    setSettings(s || null);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel("tasks-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks" },
        () => fetchData()
      )
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

  // Open task edit dialog from search (via ?task=id)
  useEffect(() => {
    const taskId = searchParams.get("task");
    if (taskId && tasks.length > 0) {
      const task = tasks.find((t) => t.id === taskId);
      if (task) {
        setEditingTask(task);
        // Clean up the URL
        router.replace("/dashboard", { scroll: false });
      }
    }
  }, [searchParams, tasks, router]);

  const workspaceMap = Object.fromEntries(workspaces.map((w) => [w.id, w]));
  const todayStr = today();

  const hasActiveFilters = filterWorkspace !== "all" || filterPriority !== "all";

  const applyFilters = (taskList: Task[]) => {
    let filtered = taskList;
    if (filterWorkspace !== "all") {
      filtered = filtered.filter((t) => t.workspace_id === filterWorkspace);
    }
    if (filterPriority !== "all") {
      filtered = filtered.filter((t) => t.priority === filterPriority);
    }
    return filtered;
  };

  // Task categories (filtered)
  const filteredTasks = applyFilters(tasks);

  const plannedToday = filteredTasks
    .filter((t) => t.planned_date === todayStr && t.status !== "done")
    .sort((a, b) => {
      // Focus tasks first, then by position
      if (a.is_focus && !b.is_focus) return -1;
      if (!a.is_focus && b.is_focus) return 1;
      return (a.position || 0) - (b.position || 0);
    });

  const focusTasks = plannedToday.filter((t) => t.is_focus);

  const overdueTasks = filteredTasks.filter(
    (t) =>
      t.due_date &&
      t.due_date < todayStr &&
      t.status !== "done"
  );

  const completedToday = filteredTasks.filter(
    (t) =>
      t.status === "done" &&
      t.completed_at &&
      t.completed_at.split("T")[0] === todayStr
  );

  const unplannedActive = filteredTasks.filter(
    (t) =>
      t.status !== "done" &&
      t.planned_date !== todayStr &&
      !(t.due_date && t.due_date < todayStr)
  );

  const capacity = calculateCapacity(tasks, new Date(), settings); // Always use unfiltered for capacity
  const planningDone = settings?.planning_completed_date === todayStr;

  const {
    handleToggle,
    handleDelete,
    handleEdit,
    handleAdd: handleAddTask,
  } = useTaskActions(tasks, fetchData);

  const handleStatusChange = async (taskId: string, newStatus: Task["status"]) => {
    await supabase.from("tasks").update({
      status: newStatus,
      completed_at: newStatus === "done" ? new Date().toISOString() : null,
    }).eq("id", taskId);
    fetchData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex items-center gap-3 text-muted-foreground">
          <div className="h-5 w-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <span className="text-sm">Loading...</span>
        </div>
      </div>
    );
  }

  const shutdownDone = settings?.shutdown_completed_date === todayStr;
  const isNewUser = !settings;

  // Show onboarding for new users
  if (!loading && isNewUser) {
    return (
      <WelcomeFlow
        workspaces={workspaces}
        onComplete={fetchData}
      />
    );
  }

  // Show morning ritual
  if (showRitual) {
    return (
      <MorningRitual
        tasks={tasks}
        workspaces={workspaces}
        settings={settings}
        onComplete={() => {
          setShowRitual(false);
          fetchData();
        }}
        onCancel={() => setShowRitual(false)}
      />
    );
  }

  // Show shutdown ritual
  if (showShutdown) {
    return (
      <ShutdownRitual
        tasks={tasks}
        workspaces={workspaces}
        settings={settings}
        onComplete={() => {
          setShowShutdown(false);
          fetchData();
        }}
        onCancel={() => setShowShutdown(false)}
      />
    );
  }

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="pt-10 md:pt-2 flex items-start justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">
            {greeting()}, Justin
          </h1>
          <p className="text-muted-foreground text-sm">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ViewToggle view={taskView} onChange={setTaskView} />
          {!planningDone && (
            <Button
              onClick={() => setShowRitual(true)}
              className="gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white border-0 rounded-xl shadow-lg shadow-indigo-500/25"
              size="sm"
            >
              <Sunrise className="h-4 w-4" />
              Plan My Day
            </Button>
          )}
          {planningDone && !shutdownDone && (
            <Button
              onClick={() => setShowShutdown(true)}
              variant="outline"
              className="gap-2 rounded-xl border-violet-500/30 text-violet-400 hover:bg-violet-500/10"
              size="sm"
            >
              <Moon className="h-4 w-4" />
              Shutdown
            </Button>
          )}
        </div>
      </div>

      {/* Daily intention */}
      {settings?.daily_intention && planningDone && (
        <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4">
          <p className="text-sm text-indigo-300 italic">
            &ldquo;{settings.daily_intention}&rdquo;
          </p>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-medium">Filter:</span>
        {[{ id: "all", label: "All" }, ...workspaces.map((ws) => ({ id: ws.id, label: ws.name }))].map((item) => (
          <button
            key={item.id}
            onClick={() => setFilterWorkspace(item.id)}
            className={cn(
              "px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all duration-200",
              filterWorkspace === item.id
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {item.label}
          </button>
        ))}
        <span className="text-border">|</span>
        {[
          { id: "all", label: "Any Priority" },
          { id: "high", label: "High" },
          { id: "medium", label: "Medium" },
          { id: "low", label: "Low" },
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => setFilterPriority(item.id)}
            className={cn(
              "px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all duration-200",
              filterPriority === item.id
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {item.label}
          </button>
        ))}
        {hasActiveFilters && (
          <button
            onClick={() => { setFilterWorkspace("all"); setFilterPriority("all"); }}
            className="px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Kanban view */}
      {taskView === "kanban" ? (
        <>
          <KanbanBoard
            tasks={filteredTasks}
            workspaceMap={workspaceMap}
            onStatusChange={handleStatusChange}
            onEdit={setEditingTask}
          />
          <AddTaskForm workspaces={workspaces} onAdd={handleAddTask} />
        </>
      ) : (
        <>
          {/* Overdue alert */}
          {overdueTasks.length > 0 && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 space-y-3">
              <div className="flex items-center gap-2 text-red-400">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm font-semibold">
                  {overdueTasks.length} overdue task
                  {overdueTasks.length > 1 ? "s" : ""}
                </span>
              </div>
              <div className="space-y-2">
                {overdueTasks.map((task) => (
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
            </div>
          )}

          {/* Capacity bar */}
          {plannedToday.length > 0 && <CapacityBar capacity={capacity} />}

          {/* Focus tasks */}
          {focusTasks.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 text-indigo-400 fill-indigo-400" />
                <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
                  Today&apos;s Focus
                </h2>
              </div>
              <div className="space-y-2">
                {focusTasks.map((task) => (
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
            </div>
          )}

          {/* Today's planned tasks (non-focus) */}
          {plannedToday.filter((t) => !t.is_focus).length > 0 && (
            <div className="space-y-3">
              <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
                Planned for Today
              </h2>
              <div className="space-y-2">
                {plannedToday
                  .filter((t) => !t.is_focus)
                  .map((task) => (
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
            </div>
          )}

          {/* Empty state for today */}
          {plannedToday.length === 0 && overdueTasks.length === 0 && (
            <div className="text-center py-12 space-y-4">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/50">
                <ListTodo className="h-7 w-7 text-muted-foreground" />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Nothing planned for today</p>
                <p className="text-xs text-muted-foreground">
                  Start your morning planning ritual or add a task below.
                </p>
              </div>
              <Button
                onClick={() => setShowRitual(true)}
                variant="outline"
                className="gap-2 rounded-xl"
                size="sm"
              >
                <Sunrise className="h-4 w-4" />
                Plan My Day
              </Button>
            </div>
          )}

          {/* Add task */}
          <AddTaskForm workspaces={workspaces} onAdd={handleAddTask} />

          {/* Completed today */}
          {completedToday.length > 0 && (
            <div className="space-y-3">
              <button
                onClick={() => setShowCompleted(!showCompleted)}
                className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-widest hover:text-foreground transition-colors"
              >
                {showCompleted ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                Completed Today ({completedToday.length})
              </button>
              {showCompleted && (
                <div className="space-y-2">
                  {completedToday.map((task) => (
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
              )}
            </div>
          )}

          {/* Backlog / all tasks */}
          {unplannedActive.length > 0 && (
            <div className="space-y-3">
              <button
                onClick={() => setShowAllTasks(!showAllTasks)}
                className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-widest hover:text-foreground transition-colors"
              >
                {showAllTasks ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
                Backlog ({unplannedActive.length})
              </button>
              {showAllTasks && (
                <div className="space-y-2">
                  {unplannedActive.map((task) => (
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
              )}
            </div>
          )}
        </>
      )}

      {/* Edit dialog */}
      <EditTaskDialog
        task={editingTask}
        workspaces={workspaces}
        open={!!editingTask}
        onClose={() => setEditingTask(null)}
        onSave={handleEdit}
      />
    </div>
  );
}
