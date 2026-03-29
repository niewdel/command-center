"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Project, Client, Task, Note, Workspace } from "@/types/database";
import { TaskItem } from "@/components/tasks/task-item";
import { AddTaskForm } from "@/components/tasks/add-task-form";
import { EditTaskDialog } from "@/components/tasks/edit-task-dialog";
import { useTaskActions } from "@/lib/hooks/use-task-actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Pencil,
  FileText,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const projectId = params.projectId as string;

  const [project, setProject] = useState<Project | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [allWorkspaces, setAllWorkspaces] = useState<Workspace[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionText, setDescriptionText] = useState("");
  const [showDone, setShowDone] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const [{ data: p }, { data: ws }, { data: allWs }] = await Promise.all([
      supabase.from("projects").select("*").eq("id", projectId).single(),
      supabase.from("workspaces").select("*").eq("slug", slug).single(),
      supabase.from("workspaces").select("*").order("name"),
    ]);

    if (p && ws) {
      setProject(p);
      setWorkspace(ws);
      setAllWorkspaces(allWs || []);
      setDescriptionText(p.description || "");

      const [{ data: t }, { data: n }] = await Promise.all([
        supabase.from("tasks").select("*").eq("project_id", projectId).order("created_at", { ascending: false }),
        supabase.from("notes").select("*").eq("project_id", projectId).order("created_at", { ascending: false }),
      ]);
      setTasks(t || []);
      setNotes(n || []);

      if (p.client_id) {
        const { data: c } = await supabase.from("clients").select("*").eq("id", p.client_id).single();
        setClient(c || null);
      }
    }
    setLoading(false);
  }, [projectId, slug]);

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel(`project-${projectId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "notes" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "projects" }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, fetchData]);

  const { handleToggle, handleDelete, handleEdit, handleAdd: handleAddTask } = useTaskActions(tasks, fetchData);

  const saveDescription = async () => {
    if (!project) return;
    await supabase.from("projects").update({ description: descriptionText || null }).eq("id", project.id);
    setEditingDescription(false);
    fetchData();
  };

  const updateStatus = async (newStatus: string) => {
    if (!project) return;
    await supabase.from("projects").update({ status: newStatus }).eq("id", project.id);
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

  if (!project || !workspace) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Project not found</p>
      </div>
    );
  }

  const activeTasks = tasks.filter((t) => t.status !== "done");
  const doneTasks = tasks.filter((t) => t.status === "done");

  const statusConfig = {
    active: { label: "Active", className: "bg-emerald-500/20 text-emerald-400" },
    on_hold: { label: "On Hold", className: "bg-amber-500/20 text-amber-400" },
    completed: { label: "Completed", className: "bg-muted/50 text-muted-foreground" },
  } as const;

  const backPath = client
    ? `/workspace/${slug}/client/${client.id}`
    : `/workspace/${slug}`;
  const backLabel = client ? client.name : workspace.name;

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-8">
      {/* Back + Header */}
      <div className="pt-10 md:pt-2 space-y-4">
        <button
          onClick={() => router.push(backPath)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {backLabel}
        </button>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              {client && <span>Client: {client.name}</span>}
              <span>
                <span className="text-foreground font-semibold">{activeTasks.length}</span> active tasks
              </span>
            </div>
          </div>
          <Select value={project.status} onValueChange={(v) => v && updateStatus(v)}>
            <SelectTrigger className={cn("w-[130px] h-8 rounded-lg text-xs font-medium border-0", statusConfig[project.status].className)}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border rounded-xl">
              <SelectItem value="active" className="rounded-lg text-xs">Active</SelectItem>
              <SelectItem value="on_hold" className="rounded-lg text-xs">On Hold</SelectItem>
              <SelectItem value="completed" className="rounded-lg text-xs">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Description */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
            Description
          </h2>
          {!editingDescription && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground"
              onClick={() => setEditingDescription(true)}
            >
              <Pencil className="h-3 w-3 mr-1" />
              Edit
            </Button>
          )}
        </div>
        {editingDescription ? (
          <div className="space-y-2">
            <Textarea
              value={descriptionText}
              onChange={(e) => setDescriptionText(e.target.value)}
              rows={4}
              placeholder="What's this project about?"
              className="bg-background/50 border-border/50 rounded-lg resize-none text-sm"
              autoFocus
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={saveDescription} className="h-7 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 text-white border-0 text-xs">
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setEditingDescription(false); setDescriptionText(project.description || ""); }} className="h-7 rounded-lg text-xs">
                Cancel
              </Button>
            </div>
          </div>
        ) : project.description ? (
          <div className="rounded-xl border border-border/50 bg-card/50 p-4">
            <p className="text-sm whitespace-pre-wrap">{project.description}</p>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border/50 p-4 text-center">
            <p className="text-xs text-muted-foreground/60">No description yet.</p>
          </div>
        )}
      </div>

      {/* Notes */}
      {notes.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            Notes ({notes.length})
          </h2>
          <div className="grid gap-2">
            {notes.map((note) => (
              <div
                key={note.id}
                className="rounded-xl border border-border/50 bg-card/50 p-3 hover:bg-card hover:border-border transition-all"
              >
                <p className="text-sm font-medium">{note.title}</p>
                {note.content && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{note.content}</p>
                )}
                <p className="text-[10px] text-muted-foreground/60 mt-1">
                  {new Date(note.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tasks */}
      <div className="space-y-3">
        <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
          Tasks
        </h2>
        <AddTaskForm
          workspaces={allWorkspaces}
          defaultWorkspaceId={workspace.id}
          onAdd={async (taskData) => {
            await supabase.from("tasks").insert({
              ...taskData,
              project_id: projectId,
              client_id: project.client_id,
              status: "todo",
              source: "manual",
            });
            fetchData();
          }}
        />
        {activeTasks.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">No active tasks for this project.</p>
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
                showWorkspace={false}
              />
            ))}
          </div>
        )}

        {doneTasks.length > 0 && (
          <div className="space-y-3">
            <button
              onClick={() => setShowDone(!showDone)}
              className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-widest hover:text-foreground transition-colors"
            >
              {showDone ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
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
                    showWorkspace={false}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

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
