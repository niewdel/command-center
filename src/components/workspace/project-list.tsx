"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Project, Client } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Plus, Pencil, Trash2, FolderKanban } from "lucide-react";

type ProjectListProps = {
  projects: Project[];
  clients: Client[];
  workspaceId: string;
  onRefresh: () => void;
};

const statusConfig = {
  active: { label: "Active", className: "bg-emerald-500/20 text-emerald-400" },
  on_hold: { label: "On Hold", className: "bg-amber-500/20 text-amber-400" },
  completed: { label: "Completed", className: "bg-muted/50 text-muted-foreground" },
} as const;

export function ProjectList({ projects, clients, workspaceId, onRefresh }: ProjectListProps) {
  const router = useRouter();
  const params = useParams();
  const slug = params.slug as string;
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const clientMap = Object.fromEntries(clients.map((c) => [c.id, c]));

  const handleDelete = async (id: string) => {
    await supabase.from("projects").delete().eq("id", id);
    onRefresh();
  };

  const activeProjects = projects.filter((p) => p.status === "active");
  const otherProjects = projects.filter((p) => p.status !== "active");

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
          Projects ({projects.length})
        </h2>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setEditing(null);
            setShowDialog(true);
          }}
          className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Project
        </Button>
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-8">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/50 mb-3">
            <FolderKanban className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">No projects yet</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {[...activeProjects, ...otherProjects].map((project) => {
            const status = statusConfig[project.status];
            const client = project.client_id ? clientMap[project.client_id] : null;
            return (
              <div
                key={project.id}
                className={cn(
                  "group rounded-xl border border-border/50 bg-card/50 p-4 hover:bg-card hover:border-border transition-all cursor-pointer",
                  project.status === "completed" && "opacity-60"
                )}
                onClick={() => router.push(`/workspace/${slug}/project/${project.id}`)}
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold">{project.name}</h3>
                      <span
                        className={cn(
                          "text-[10px] font-medium px-2 py-0.5 rounded-full",
                          status.className
                        )}
                      >
                        {status.label}
                      </span>
                    </div>
                    {project.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {project.description}
                      </p>
                    )}
                    {client && (
                      <p className="text-[11px] text-muted-foreground/60">
                        Client: {client.name}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all ml-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-lg"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditing(project);
                        setShowDialog(true);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-lg text-muted-foreground hover:text-red-400"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(project.id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ProjectDialog
        project={editing}
        clients={clients}
        workspaceId={workspaceId}
        open={showDialog}
        onClose={() => {
          setShowDialog(false);
          setEditing(null);
        }}
        onSaved={onRefresh}
      />
    </div>
  );
}

function ProjectDialog({
  project,
  clients,
  workspaceId,
  open,
  onClose,
  onSaved,
}: {
  project: Project | null;
  clients: Client[];
  workspaceId: string;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [clientId, setClientId] = useState<string>("none");
  const [status, setStatus] = useState<Project["status"]>("active");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (project) {
      setName(project.name);
      setDescription(project.description || "");
      setClientId(project.client_id || "none");
      setStatus(project.status);
    } else {
      setName("");
      setDescription("");
      setClientId("none");
      setStatus("active");
    }
  }, [project]);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);

    const data = {
      name: name.trim(),
      description: description || null,
      client_id: clientId === "none" ? null : clientId,
      status,
      workspace_id: workspaceId,
    };

    if (project) {
      await supabase.from("projects").update(data).eq("id", project.id);
    } else {
      await supabase.from("projects").insert(data);
    }

    setSaving(false);
    onClose();
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[460px] bg-card border-border rounded-2xl shadow-2xl shadow-black/30">
        <DialogHeader>
          <DialogTitle>{project ? "Edit Project" : "New Project"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Name
            </Label>
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Quoting Tool Build"
              className="bg-background/50 border-border/50 rounded-lg"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Description
            </Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="What's this project about?"
              className="bg-background/50 border-border/50 rounded-lg resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Client
              </Label>
              <Select value={clientId} onValueChange={(v) => v && setClientId(v)}>
                <SelectTrigger className="bg-background/50 border-border/50 rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border rounded-xl">
                  <SelectItem value="none" className="rounded-lg">No client</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id} className="rounded-lg">
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Status
              </Label>
              <Select value={status} onValueChange={(v) => setStatus(v as Project["status"])}>
                <SelectTrigger className="bg-background/50 border-border/50 rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border rounded-xl">
                  <SelectItem value="active" className="rounded-lg">Active</SelectItem>
                  <SelectItem value="on_hold" className="rounded-lg">On Hold</SelectItem>
                  <SelectItem value="completed" className="rounded-lg">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose} className="rounded-lg">
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!name.trim() || saving}
            className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white border-0 rounded-lg shadow-lg shadow-indigo-500/25"
          >
            {saving ? "Saving..." : project ? "Save Changes" : "Add Project"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
