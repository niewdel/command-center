"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Task, Workspace, Project } from "@/types/database";
import { TaskItem } from "@/components/tasks/task-item";
import { AddTaskForm } from "@/components/tasks/add-task-form";
import { EditTaskDialog } from "@/components/tasks/edit-task-dialog";
import { ProjectList } from "@/components/workspace/project-list";
import { KanbanBoard } from "@/components/tasks/kanban-board";
import { ViewToggle } from "@/components/tasks/view-toggle";
import { useTaskActions } from "@/lib/hooks/use-task-actions";
import { SkeletonPage } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, ListTodo, FolderKanban } from "lucide-react";

type Tab = "tasks" | "projects";

const priorityOrder: Record<string, number> = {
  high: 0,
  medium: 1,
  low: 2,
  none: 3,
};

export default function WorkspacePage() {
  return (
    <Suspense fallback={<SkeletonPage />}>
      <WorkspaceContent />
    </Suspense>
  );
}

function WorkspaceContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const initialTab = (searchParams.get("tab") === "projects" ? "projects" : "tasks") as Tab;
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [allWorkspaces, setAllWorkspaces] = useState<Workspace[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [taskView, setTaskView] = useState<"list" | "kanban">("list");
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const { data: ws } = await supabase
      .from("workspaces")
      .select("*")
      .eq("slug", slug)
      .single();

    const { data: allWs } = await supabase
      .from("workspaces")
      .select("*")
      .order("name");

    if (ws) {
      setWorkspace(ws);
      const [{ data: t }, { data: p }] = await Promise.all([
        supabase
          .from("tasks")
          .select("*")
          .eq("workspace_id", ws.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("projects")
          .select("*")
          .eq("workspace_id", ws.id)
          .order("created_at", { ascending: false }),
      ]);
      setTasks(t || []);
      setProjects(p || []);
    }
    setAllWorkspaces(allWs || []);
    setLoading(false);
  }, [slug]);

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel(`workspace-${slug}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "projects" }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [slug, fetchData]);

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
    return <SkeletonPage />;
  }

  if (!workspace) {
    return (
      <div className="flex items-center justify-center min-h-dvh">
        <p className="text-pretty text-muted-foreground">Workspace not found</p>
      </div>
    );
  }

  // Sort active tasks: high priority first, then by due date
  const activeTasks = tasks
    .filter((t) => t.status !== "done")
    .sort((a, b) => {
      const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (pDiff !== 0) return pDiff;
      if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
      if (a.due_date) return -1;
      if (b.due_date) return 1;
      return 0;
    });
  const doneTasks = tasks.filter((t) => t.status === "done");

  const projectMap = Object.fromEntries(projects.map((p) => [p.id, p]));

  const tabs: { id: Tab; label: string; icon: React.ReactNode; count: number }[] = [
    { id: "tasks", label: "Tasks", icon: <ListTodo className="size-3.5" />, count: activeTasks.length },
    { id: "projects", label: "Projects", icon: <FolderKanban className="size-3.5" />, count: projects.length },
  ];

  return (
    <div className="p-4 md:p-8 pb-24 md:pb-8 max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div className="pt-10 md:pt-2 space-y-4">
        <div className="flex items-center gap-4">
          <div
            className={cn("size-12 rounded-lg flex items-center justify-center shrink-0", !workspace.color?.startsWith("#") && workspace.color)}
            style={workspace.color?.startsWith("#") ? { backgroundColor: workspace.color } : undefined}
          >
            {workspace.logo_url ? (
              <img
                src={workspace.logo_url}
                alt={workspace.name}
                className="size-8 object-contain"
              />
            ) : (
              <span className="text-lg text-white font-semibold">
                {workspace.name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div>
            <h1 className="text-balance text-xl font-bold font-heading">{workspace.name}</h1>
            {workspace.description && (
              <p className="text-pretty text-muted-foreground text-sm">{workspace.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>
            <span className="text-foreground font-semibold">
              {activeTasks.length}
            </span>{" "}
            active
          </span>
          <span className="text-border">|</span>
          <span>
            <span className="text-foreground font-semibold">
              {doneTasks.length}
            </span>{" "}
            completed
          </span>
          {projects.length > 0 && (
            <>
              <span className="text-border">|</span>
              <span>
                <span className="text-foreground font-semibold">
                  {projects.length}
                </span>{" "}
                projects
              </span>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                activeTab === tab.id
                  ? "bg-foreground text-background shadow-sm"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {tab.icon}
              {tab.label}
              <span className="ml-0.5 opacity-60">{tab.count}</span>
            </button>
          ))}
      </div>

      {/* Tasks tab */}
      {activeTab === "tasks" && (
        <>
          <div className="flex items-center justify-between">
            <h2 className="text-balance text-xs font-medium text-muted-foreground uppercase font-heading">
              Tasks
            </h2>
            <ViewToggle view={taskView} onChange={setTaskView} />
          </div>

          {taskView === "kanban" ? (
            <>
              <KanbanBoard
                tasks={tasks}
                onStatusChange={handleStatusChange}
                onEdit={setEditingTask}
                showWorkspace={false}
              />
              <AddTaskForm
                workspaces={allWorkspaces}
                defaultWorkspaceId={workspace.id}
                onAdd={handleAddTask}
              />
            </>
          ) : (
            <>
              <AddTaskForm
                workspaces={allWorkspaces}
                defaultWorkspaceId={workspace.id}
                onAdd={handleAddTask}
              />

              <div className="space-y-3">
                <h2 className="text-balance text-xs font-medium text-muted-foreground uppercase font-heading">
                  Active Tasks
                </h2>
                {activeTasks.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-pretty text-sm text-muted-foreground">
                      No active tasks. Nice work.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {activeTasks.map((task) => (
                      <TaskItem
                        key={task.id}
                        task={task}
                        project={task.project_id ? projectMap[task.project_id] : undefined}
                        onToggle={handleToggle}
                        onDelete={handleDelete}
                        onEdit={setEditingTask}
                      />
                    ))}
                  </div>
                )}
              </div>

              {doneTasks.length > 0 && (
                <div className="space-y-3">
                  <button
                    onClick={() => setShowDone(!showDone)}
                    className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase font-heading hover:text-foreground transition-colors"
                  >
                    {showDone ? (
                      <ChevronUp className="size-3.5" />
                    ) : (
                      <ChevronDown className="size-3.5" />
                    )}
                    Completed ({doneTasks.length})
                  </button>
                  {showDone && (
                    <div className="space-y-2">
                      {doneTasks.map((task) => (
                        <TaskItem
                          key={task.id}
                          task={task}
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
        </>
      )}

      {/* Projects tab */}
      {activeTab === "projects" && (
        <ProjectList
          projects={projects}
          clients={[]}
          workspaceId={workspace.id}
          onRefresh={fetchData}
        />
      )}

      {/* Edit dialog */}
      <EditTaskDialog
        task={editingTask}
        workspaces={allWorkspaces}
        projects={projects}
        open={!!editingTask}
        onClose={() => setEditingTask(null)}
        onSave={handleEdit}
      />
    </div>
  );
}
