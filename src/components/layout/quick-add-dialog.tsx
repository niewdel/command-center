"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Workspace } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { ESTIMATE_PRESETS } from "@/lib/capacity";
import { cn, localDateString } from "@/lib/utils";
import { Zap } from "lucide-react";

type QuickAddDialogProps = {
  open: boolean;
  onClose: () => void;
};

export function QuickAddDialog({ open, onClose }: QuickAddDialogProps) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [title, setTitle] = useState("");
  const [workspaceId, setWorkspaceId] = useState("");
  const [priority, setPriority] = useState("none");
  const [dueDate, setDueDate] = useState("");
  const [estimateMinutes, setEstimateMinutes] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const today = localDateString();

  useEffect(() => {
    if (open && workspaces.length === 0) {
      supabase
        .from("workspaces")
        .select("*")
        .order("name")
        .then(({ data }) => {
          if (data) {
            setWorkspaces(data);
            setWorkspaceId(data[0]?.id || "");
          }
        });
    }
  }, [open, workspaces.length]);

  const reset = useCallback(() => {
    setTitle("");
    setPriority("none");
    setDueDate("");
    setEstimateMinutes(null);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !workspaceId) return;

    setLoading(true);
    await supabase.from("tasks").insert({
      title: title.trim(),
      workspace_id: workspaceId,
      priority,
      due_date: dueDate || null,
      estimated_minutes: estimateMinutes,
      planned_date: null,
      status: "todo",
      source: "manual",
    });
    setLoading(false);
    reset();
    onClose();
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      reset();
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[420px] max-h-[85dvh] overflow-y-auto bg-card border-border rounded-2xl shadow-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Quick Add Task</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-2">
            <Input
              autoFocus
              placeholder="What needs to be done?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-background/50 border-border/50 rounded-lg h-11 text-sm focus-visible:ring-primary/50"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase">
                Workspace
              </Label>
              <Select value={workspaceId} onValueChange={(v) => v && setWorkspaceId(v)}>
                <SelectTrigger className="bg-background/50 border-border/50 rounded-lg">
                  <SelectValue placeholder="Workspace">
                    {workspaces.find((ws) => ws.id === workspaceId)?.name ?? "Workspace"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="bg-popover border-border rounded-lg">
                  {workspaces.map((ws) => (
                    <SelectItem key={ws.id} value={ws.id} className="rounded-lg">
                      {ws.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase">
                Priority
              </Label>
              <Select value={priority} onValueChange={(v) => v && setPriority(v)}>
                <SelectTrigger className="bg-background/50 border-border/50 rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border rounded-lg">
                  <SelectItem value="none" className="rounded-lg">None</SelectItem>
                  <SelectItem value="low" className="rounded-lg">Low</SelectItem>
                  <SelectItem value="medium" className="rounded-lg">Medium</SelectItem>
                  <SelectItem value="high" className="rounded-lg">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground uppercase">
              Due Date
            </Label>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="bg-background/50 border-border/50 rounded-lg"
            />
          </div>

          {/* Time estimate chips */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground uppercase">
              Time Estimate
            </Label>
            <div className="flex items-center gap-1.5 flex-wrap">
              {ESTIMATE_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() =>
                    setEstimateMinutes(
                      estimateMinutes === preset.value ? null : preset.value
                    )
                  }
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                    estimateMinutes === preset.value
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleOpenChange(false)}
              className="rounded-lg text-muted-foreground hover:text-foreground"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!title.trim() || loading}
              className="gap-1.5 bg-foreground text-background hover:bg-foreground/90 border-0 rounded-lg shadow-sm"
            >
              <Zap className="size-3.5" />
              {loading ? "Adding..." : "Add Task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
