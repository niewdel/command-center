"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Note, Workspace } from "@/types/database";
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
import { FileText, Plus, Pencil, Trash2 } from "lucide-react";

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [filterWorkspace, setFilterWorkspace] = useState<string>("all");
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const [{ data: n }, { data: w }] = await Promise.all([
      supabase.from("notes").select("*").order("created_at", { ascending: false }),
      supabase.from("workspaces").select("*").order("name"),
    ]);
    setNotes(n || []);
    setWorkspaces(w || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel("notes-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "notes" }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  const workspaceMap = Object.fromEntries(workspaces.map((w) => [w.id, w]));
  const filtered =
    filterWorkspace === "all"
      ? notes
      : notes.filter((n) => n.workspace_id === filterWorkspace);

  const handleDelete = async (id: string) => {
    await supabase.from("notes").delete().eq("id", id);
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

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-6">
      <div className="pt-10 md:pt-2 flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-foreground flex items-center justify-center shadow-md">
              <FileText className="size-5 text-background" />
            </div>
            <h1 className="text-2xl font-bold text-balance">Notes</h1>
          </div>
        </div>
        <Button
          onClick={() => {
            setEditingNote(null);
            setShowEditor(true);
          }}
          className="gap-2 bg-foreground hover:bg-foreground/90 text-background border-0 rounded-lg shadow-md"
          size="sm"
        >
          <Plus className="size-4" />
          New Note
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {[
          { id: "all", label: "All" },
          ...workspaces.map((ws) => ({ id: ws.id, label: ws.name })),
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => setFilterWorkspace(item.id)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
              filterWorkspace === item.id
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Notes list */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="inline-flex size-14 items-center justify-center rounded-2xl bg-muted/50 mb-4">
            <FileText className="size-7 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-pretty">No notes yet</p>
          <p className="text-xs text-muted-foreground mt-1 text-pretty">
            Capture thoughts, meeting notes, and plans.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((note) => {
            const ws = workspaceMap[note.workspace_id];
            return (
              <div
                key={note.id}
                className="group rounded-lg border border-border/50 bg-card/50 p-4 hover:bg-card hover:border-border transition-colors cursor-pointer"
                onClick={() => {
                  setEditingNote(note);
                  setShowEditor(true);
                }}
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1 flex-1 min-w-0">
                    <h3 className="text-sm font-semibold truncate">{note.title}</h3>
                    {note.content && (
                      <p className="text-xs text-muted-foreground line-clamp-2 text-pretty">
                        {note.content}
                      </p>
                    )}
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground pt-1">
                      {ws && <span>{ws.name}</span>}
                      {note.type === "meeting" && (
                        <>
                          <span className="text-border">|</span>
                          <span className="text-purple-400">Meeting</span>
                        </>
                      )}
                      <span className="text-border">|</span>
                      <span>
                        {new Date(note.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(note.id);
                      }}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Note Editor */}
      <NoteEditor
        note={editingNote}
        workspaces={workspaces}
        open={showEditor}
        onClose={() => {
          setShowEditor(false);
          setEditingNote(null);
        }}
        onSaved={fetchData}
      />
    </div>
  );
}

function NoteEditor({
  note,
  workspaces,
  open,
  onClose,
  onSaved,
}: {
  note: Note | null;
  workspaces: Workspace[];
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [workspaceId, setWorkspaceId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (note) {
      setTitle(note.title);
      setContent(note.content || "");
      setWorkspaceId(note.workspace_id);
    } else {
      setTitle("");
      setContent("");
      setWorkspaceId(workspaces[0]?.id || "");
    }
  }, [note, workspaces]);

  const handleSave = async () => {
    if (!title.trim() || !workspaceId) return;
    setSaving(true);

    const data = {
      title: title.trim(),
      content: content || null,
      workspace_id: workspaceId,
    };

    if (note) {
      await supabase.from("notes").update(data).eq("id", note.id);
    } else {
      await supabase.from("notes").insert({ ...data, type: "note", source: "manual" });
    }

    setSaving(false);
    onClose();
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] bg-card border-border rounded-lg shadow-md">
        <DialogHeader>
          <DialogTitle>{note ? "Edit Note" : "New Note"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <Input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Note title"
            className="bg-background/50 border-border/50 rounded-lg h-11 text-base font-medium"
          />
          <Select value={workspaceId} onValueChange={(v) => v && setWorkspaceId(v)}>
            <SelectTrigger className="w-[180px] bg-background/50 border-border/50 rounded-lg">
              <SelectValue placeholder="Workspace" />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border rounded-lg">
              {workspaces.map((ws) => (
                <SelectItem key={ws.id} value={ws.id} className="rounded-lg">
                  {ws.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={12}
            placeholder="Write your note here... (Markdown supported)"
            className="bg-background/50 border-border/50 rounded-lg resize-none font-mono text-sm"
          />
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose} className="rounded-lg">
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!title.trim() || saving}
            className="bg-foreground hover:bg-foreground/90 text-background border-0 rounded-lg shadow-sm"
          >
            {saving ? "Saving..." : note ? "Save Changes" : "Create Note"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
