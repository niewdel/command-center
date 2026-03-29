"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { Task, Workspace, Client, Project } from "@/types/database";
import { TaskItem } from "@/components/tasks/task-item";
import { AddTaskForm } from "@/components/tasks/add-task-form";
import { EditTaskDialog } from "@/components/tasks/edit-task-dialog";
import { ClientList } from "@/components/workspace/client-list";
import { ProjectList } from "@/components/workspace/project-list";
import { KanbanBoard } from "@/components/tasks/kanban-board";
import { ViewToggle } from "@/components/tasks/view-toggle";
import { useTaskActions } from "@/lib/hooks/use-task-actions";
import { cn } from "@/lib/utils";
import { User, ChevronDown, ChevronUp, ListTodo, Users, FolderKanban } from "lucide-react";

const workspaceMeta: Record<
  string,
  {
    logo?: string;
    logoWidth?: number;
    color: string;
    description: string;
  }
> = {
  niewdel: {
    logo: "/logos/niewdel-wordmark.png",
    logoWidth: 140,
    color: "bg-violet-500",
    description: "AI & Automation Consulting",
  },
  i10: {
    logo: "/logos/i10-logo.png",
    logoWidth: 160,
    color: "bg-emerald-500",
    description: "Sandler Sales Training Franchise",
  },
  personal: {
    color: "bg-amber-500",
    description: "Personal tasks, notes & goals",
  },
};

type Tab = "tasks" | "clients" | "projects";

const priorityOrder: Record<string, number> = {
  high: 0,
  medium: 1,
  low: 2,
  none: 3,
};

export default function WorkspacePage() {
  const params = useParams();
  const slug = params.slug as string;
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [allWorkspaces, setAllWorkspaces] = useState<Workspace[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("tasks");
  const [taskView, setTaskView] = useState<"list" | "kanban">("list");
  const [loading, setLoading] = useState(true);

  const meta = workspaceMeta[slug] || workspaceMeta.personal;

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
      const [{ data: t }, { data: c }, { data: p }] = await Promise.all([
        supabase
          .from("tasks")
          .select("*")
          .eq("workspace_id", ws.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("clients")
          .select("*")
          .eq("workspace_id", ws.id)
          .order("name"),
        supabase
          .from("projects")
          .select("*")
          .eq("workspace_id", ws.id)
          .order("created_at", { ascending: false }),
      ]);
      setTasks(t || []);
      setClients(c || []);
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
      .on("postgres_changes", { event: "*", schema: "public", table: "clients" }, () => fetchData())
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
    return (
      <div className="flex items-center justify-center min-h-dvh">
        <div className="flex items-center gap-3 text-muted-foreground">
          <div className="size-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <span className="text-sm">Loading...</span>
        </div>
      </div>
    );
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

  // Determine which tabs to show (hide empty clients/projects for workspaces that don't use them)
  const hasTabs = clients.length > 0 || projects.length > 0 || slug === "niewdel";
  const tabs: { id: Tab; label: string; icon: React.ReactNode; count: number }[] = [
    { id: "tasks", label: "Tasks", icon: <ListTodo className="size-3.5" />, count: activeTasks.length },
    ...(hasTabs
      ? [
          { id: "clients" as Tab, label: "Clients", icon: <Users className="size-3.5" />, count: clients.length },
          { id: "projects" as Tab, label: "Projects", icon: <FolderKanban className="size-3.5" />, count: projects.length },
        ]
      : []),
  ];

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div className="pt-10 md:pt-2 space-y-4">
        <div
          className={`inline-flex items-center gap-4 rounded-2xl ${meta.color} p-[1px]`}
        >
          <div className="flex items-center gap-4 rounded-2xl bg-background px-5 py-3">
            {meta.logo ? (
              <Image
                src={meta.logo}
                alt={workspace.name}
                width={meta.logoWidth || 120}
                height={40}
                className="object-contain h-8 w-auto invert brightness-200"
              />
            ) : (
              <div className="flex items-center gap-3">
                <div
                  className={`size-10 rounded-lg ${meta.color} flex items-center justify-center shadow-md`}
                >
                  <User className="size-5 text-white" />
                </div>
                <h1 className="text-balance text-xl font-bold">{workspace.name}</h1>
              </div>
            )}
          </div>
        </div>
        <p className="text-pretty text-muted-foreground text-sm">{meta.description}</p>
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
          {clients.length > 0 && (
            <>
              <span className="text-border">|</span>
              <span>
                <span className="text-foreground font-semibold">
                  {clients.length}
                </span>{" "}
                clients
              </span>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      {tabs.length > 1 && (
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
      )}

      {/* Tasks tab */}
      {activeTab === "tasks" && (
        <>
          <div className="flex items-center justify-between">
            <h2 className="text-balance text-xs font-medium text-muted-foreground uppercase">
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
                <h2 className="text-balance text-xs font-medium text-muted-foreground uppercase">
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
                    className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase hover:text-foreground transition-colors"
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

      {/* Clients tab */}
      {activeTab === "clients" && (
        <ClientList
          clients={clients}
          workspaceId={workspace.id}
          onRefresh={fetchData}
        />
      )}

      {/* Projects tab */}
      {activeTab === "projects" && (
        <ProjectList
          projects={projects}
          clients={clients}
          workspaceId={workspace.id}
          onRefresh={fetchData}
        />
      )}

      {/* Edit dialog */}
      <EditTaskDialog
        task={editingTask}
        workspaces={allWorkspaces}
        open={!!editingTask}
        onClose={() => setEditingTask(null)}
        onSave={handleEdit}
      />
    </div>
  );
}
