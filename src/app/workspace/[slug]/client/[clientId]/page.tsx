"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Client, Project, Task, Note, Workspace } from "@/types/database";
import { TaskItem } from "@/components/tasks/task-item";
import { AddTaskForm } from "@/components/tasks/add-task-form";
import { EditTaskDialog } from "@/components/tasks/edit-task-dialog";
import { useTaskActions } from "@/lib/hooks/use-task-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  ExternalLink,
  Plus,
  Pencil,
  Trash2,
  X,
  FolderKanban,
  FileText,
  LinkIcon,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

export default function ClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const clientId = params.clientId as string;

  const [client, setClient] = useState<Client | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [allWorkspaces, setAllWorkspaces] = useState<Workspace[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesText, setNotesText] = useState("");
  const [editingLinks, setEditingLinks] = useState(false);
  const [linksText, setLinksText] = useState("");
  const [showDone, setShowDone] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const [{ data: c }, { data: ws }, { data: allWs }] = await Promise.all([
      supabase.from("clients").select("*").eq("id", clientId).single(),
      supabase.from("workspaces").select("*").eq("slug", slug).single(),
      supabase.from("workspaces").select("*").order("name"),
    ]);

    if (c && ws) {
      setClient(c);
      setWorkspace(ws);
      setAllWorkspaces(allWs || []);
      setNotesText(c.notes || "");
      setLinksText(
        c.links ? c.links.map((l: { label: string; url: string }) => `${l.label}: ${l.url}`).join("\n") : ""
      );

      const [{ data: p }, { data: t }, { data: n }] = await Promise.all([
        supabase.from("projects").select("*").eq("client_id", clientId).order("created_at", { ascending: false }),
        supabase.from("tasks").select("*").eq("client_id", clientId).order("created_at", { ascending: false }),
        supabase.from("notes").select("*").eq("client_id", clientId).order("created_at", { ascending: false }),
      ]);
      setProjects(p || []);
      setTasks(t || []);
      setNotes(n || []);
    }
    setLoading(false);
  }, [clientId, slug]);

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel(`client-${clientId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "projects" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "notes" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "clients" }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clientId, fetchData]);

  const { handleToggle, handleDelete, handleEdit, handleAdd: handleAddTask } = useTaskActions(tasks, fetchData);

  const parseLinks = (text: string): { label: string; url: string }[] => {
    return text
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => {
        const colonIndex = line.indexOf(":");
        if (colonIndex > 0 && line.includes("//")) {
          return { label: line.substring(0, colonIndex).trim(), url: line.substring(colonIndex + 1).trim() };
        }
        return { label: line.trim(), url: line.trim() };
      });
  };

  const saveNotes = async () => {
    if (!client) return;
    await supabase.from("clients").update({ notes: notesText || null }).eq("id", client.id);
    setEditingNotes(false);
    fetchData();
  };

  const saveLinks = async () => {
    if (!client) return;
    await supabase
      .from("clients")
      .update({ links: linksText.trim() ? parseLinks(linksText) : [] })
      .eq("id", client.id);
    setEditingLinks(false);
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

  if (!client || !workspace) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Client not found</p>
      </div>
    );
  }

  const activeTasks = tasks.filter((t) => t.status !== "done");
  const doneTasks = tasks.filter((t) => t.status === "done");
  const overdueTasks = activeTasks.filter(
    (t) => t.due_date && t.due_date < new Date().toISOString().split("T")[0]
  );

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-8">
      {/* Back + Header */}
      <div className="pt-10 md:pt-2 space-y-4">
        <button
          onClick={() => router.push(`/workspace/${slug}`)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {workspace.name}
        </button>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">{client.name}</h1>
              <span
                className={cn(
                  "text-[10px] font-medium px-2 py-0.5 rounded-full",
                  client.type === "full"
                    ? "bg-violet-500/20 text-violet-400"
                    : "bg-muted/50 text-muted-foreground"
                )}
              >
                {client.type}
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span>
                <span className="text-foreground font-semibold">{activeTasks.length}</span> active tasks
              </span>
              <span className="text-border">|</span>
              <span>
                <span className="text-foreground font-semibold">{projects.length}</span> projects
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Overdue alert */}
      {overdueTasks.length > 0 && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-3">
          <p className="text-xs font-semibold text-red-400">
            {overdueTasks.length} overdue task{overdueTasks.length > 1 ? "s" : ""}
          </p>
        </div>
      )}

      {/* Important Notes */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
            Important Notes
          </h2>
          {!editingNotes && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground"
              onClick={() => setEditingNotes(true)}
            >
              <Pencil className="h-3 w-3 mr-1" />
              Edit
            </Button>
          )}
        </div>
        {editingNotes ? (
          <div className="space-y-2">
            <Textarea
              value={notesText}
              onChange={(e) => setNotesText(e.target.value)}
              rows={6}
              placeholder="Client notes, context, important details..."
              className="bg-background/50 border-border/50 rounded-lg resize-none font-mono text-sm"
              autoFocus
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={saveNotes} className="h-7 rounded-lg bg-gradient-to-r from-violet-500 to-purple-600 text-white border-0 text-xs">
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setEditingNotes(false); setNotesText(client.notes || ""); }} className="h-7 rounded-lg text-xs">
                Cancel
              </Button>
            </div>
          </div>
        ) : client.notes ? (
          <div className="rounded-xl border border-border/50 bg-card/50 p-4">
            <p className="text-sm whitespace-pre-wrap">{client.notes}</p>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border/50 p-4 text-center">
            <p className="text-xs text-muted-foreground/60">No notes yet. Click edit to add some.</p>
          </div>
        )}
      </div>

      {/* Important Links */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
            <LinkIcon className="h-3.5 w-3.5" />
            Links
          </h2>
          {!editingLinks && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground"
              onClick={() => setEditingLinks(true)}
            >
              <Pencil className="h-3 w-3 mr-1" />
              Edit
            </Button>
          )}
        </div>
        {editingLinks ? (
          <div className="space-y-2">
            <Textarea
              value={linksText}
              onChange={(e) => setLinksText(e.target.value)}
              rows={4}
              placeholder={"Portal: https://client-portal.com\nDrive: https://drive.google.com/..."}
              className="bg-background/50 border-border/50 rounded-lg resize-none font-mono text-xs"
              autoFocus
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={saveLinks} className="h-7 rounded-lg bg-gradient-to-r from-violet-500 to-purple-600 text-white border-0 text-xs">
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setEditingLinks(false); setLinksText(client.links ? client.links.map((l: { label: string; url: string }) => `${l.label}: ${l.url}`).join("\n") : ""); }} className="h-7 rounded-lg text-xs">
                Cancel
              </Button>
            </div>
          </div>
        ) : client.links && client.links.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {client.links.map((link: { label: string; url: string }, i: number) => (
              <a
                key={i}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/50 bg-card/50 text-xs font-medium hover:bg-card hover:border-border transition-all"
              >
                <ExternalLink className="h-3 w-3 text-primary" />
                {link.label}
              </a>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border/50 p-4 text-center">
            <p className="text-xs text-muted-foreground/60">No links yet. Click edit to add some.</p>
          </div>
        )}
      </div>

      {/* Projects */}
      {projects.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
            <FolderKanban className="h-3.5 w-3.5" />
            Projects ({projects.length})
          </h2>
          <div className="grid gap-2">
            {projects.map((project) => (
              <button
                key={project.id}
                onClick={() => router.push(`/workspace/${slug}/project/${project.id}`)}
                className="flex items-center justify-between rounded-xl border border-border/50 bg-card/50 p-3 hover:bg-card hover:border-border transition-all text-left"
              >
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">{project.name}</p>
                  {project.description && (
                    <p className="text-xs text-muted-foreground line-clamp-1">{project.description}</p>
                  )}
                </div>
                <span
                  className={cn(
                    "text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ml-2",
                    project.status === "active" && "bg-emerald-500/20 text-emerald-400",
                    project.status === "on_hold" && "bg-amber-500/20 text-amber-400",
                    project.status === "completed" && "bg-muted/50 text-muted-foreground"
                  )}
                >
                  {project.status === "on_hold" ? "On Hold" : project.status}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Meeting Notes */}
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
                  {note.type === "meeting" && " \u00b7 Meeting"}
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
              client_id: clientId,
              status: "todo",
              source: "manual",
            });
            fetchData();
          }}
        />
        {activeTasks.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">No active tasks for this client.</p>
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
