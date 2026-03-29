"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { InboxItem, Workspace } from "@/types/database";

type CreateTaskFromEmailProps = {
  item: InboxItem | null;
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
};

export function CreateTaskFromEmail({
  item,
  open,
  onClose,
  onCreated,
}: CreateTaskFromEmailProps) {
  const [title, setTitle] = useState("");
  const [workspaceId, setWorkspaceId] = useState("");
  const [priority, setPriority] = useState<string>("medium");
  const [dueDate, setDueDate] = useState("");
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (item && open) {
      setTitle(item.subject || "");
      setDueDate("");
      setPriority("medium");
    }
  }, [item, open]);

  useEffect(() => {
    async function fetchWorkspaces() {
      const { data, error } = await supabase
        .from("workspaces")
        .select("*")
        .order("position", { ascending: true });

      if (!error && data) {
        setWorkspaces(data as Workspace[]);
        if (data.length > 0 && !workspaceId) {
          setWorkspaceId(data[0].id);
        }
      }
    }

    if (open) {
      fetchWorkspaces();
    }
  }, [open, workspaceId]);

  const handleSave = async () => {
    if (!title.trim() || !workspaceId || !item) return;

    setSaving(true);

    // Create the task
    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .insert({
        title: title.trim(),
        workspace_id: workspaceId,
        priority,
        due_date: dueDate || null,
        status: "todo",
        source: "email",
        inbox_item_id: item.id,
      })
      .select()
      .single();

    if (!taskError && task) {
      // Link the inbox item to the task
      await supabase
        .from("inbox_items")
        .update({ task_id: task.id, updated_at: new Date().toISOString() })
        .eq("id", item.id);

      onCreated();
      onClose();
    }

    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Task from Email</DialogTitle>
          <DialogDescription>
            Turn this email into an actionable task.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="task-title">Title</Label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title"
            />
          </div>

          {/* Workspace */}
          <div className="space-y-1.5">
            <Label>Workspace</Label>
            <Select value={workspaceId} onValueChange={(v) => v && setWorkspaceId(v)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select workspace" />
              </SelectTrigger>
              <SelectContent>
                {workspaces.map((ws) => (
                  <SelectItem key={ws.id} value={ws.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className="size-2.5 rounded-full"
                        style={{ backgroundColor: ws.color }}
                      />
                      {ws.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Priority */}
          <div className="space-y-1.5">
            <Label>Priority</Label>
            <Select value={priority} onValueChange={(v) => v && setPriority(v)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Due date */}
          <div className="space-y-1.5">
            <Label htmlFor="task-due-date">Due Date</Label>
            <Input
              id="task-due-date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !title.trim() || !workspaceId}>
            {saving ? "Creating..." : "Create Task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
