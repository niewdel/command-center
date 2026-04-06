"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Zap } from "lucide-react";
import { Workspace } from "@/types/database";
import { ESTIMATE_PRESETS } from "@/lib/capacity";
import { cn } from "@/lib/utils";

type AddTaskFormProps = {
  workspaces: Workspace[];
  defaultWorkspaceId?: string;
  onAdd: (task: {
    title: string;
    workspace_id: string;
    priority: string;
    due_date: string | null;
    estimated_minutes: number | null;
    planned_date: string | null;
  }) => void;
};

export function AddTaskForm({
  workspaces,
  defaultWorkspaceId,
  onAdd,
}: AddTaskFormProps) {
  const [title, setTitle] = useState("");
  const [workspaceId, setWorkspaceId] = useState(
    defaultWorkspaceId || workspaces[0]?.id || ""
  );
  const [priority, setPriority] = useState("none");
  const [dueDate, setDueDate] = useState("");
  const [estimateMinutes, setEstimateMinutes] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);

  const today = new Date().toISOString().split("T")[0];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    onAdd({
      title: title.trim(),
      workspace_id: workspaceId,
      priority,
      due_date: dueDate || null,
      estimated_minutes: estimateMinutes,
      planned_date: today,
    });

    setTitle("");
    setPriority("none");
    setDueDate("");
    setEstimateMinutes(null);
    setExpanded(false);
  };

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="w-full flex items-center gap-3 rounded-lg border border-dashed border-border/60 bg-card/30 p-4 text-sm text-muted-foreground hover:bg-card/60 hover:border-primary/30 hover:text-foreground transition-colors group"
      >
        <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
          <Plus className="size-4 text-primary" />
        </div>
        Add a task...
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-border bg-card p-4 space-y-3 shadow-md"
    >
      <Input
        autoFocus
        placeholder="What needs to be done?"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="bg-background/50 border-border/50 rounded-lg h-10 text-sm focus-visible:ring-primary/50"
      />
      <div className="flex gap-2 flex-wrap">
        {!defaultWorkspaceId && (
          <Select value={workspaceId} onValueChange={(v) => v && setWorkspaceId(v)}>
            <SelectTrigger className="w-[140px] bg-background/50 border-border/50 rounded-lg h-9 text-xs">
              <SelectValue placeholder="Workspace">
                {workspaces.find((ws) => ws.id === workspaceId)?.name ?? "Workspace"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="bg-popover border-border rounded-lg">
              {workspaces.map((ws) => (
                <SelectItem key={ws.id} value={ws.id} className="rounded-lg text-xs">
                  {ws.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={priority} onValueChange={(v) => v && setPriority(v)}>
          <SelectTrigger className="w-[120px] bg-background/50 border-border/50 rounded-lg h-9 text-xs">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border rounded-lg">
            <SelectItem value="none" className="rounded-lg text-xs">No priority</SelectItem>
            <SelectItem value="low" className="rounded-lg text-xs">Low</SelectItem>
            <SelectItem value="medium" className="rounded-lg text-xs">Medium</SelectItem>
            <SelectItem value="high" className="rounded-lg text-xs">High</SelectItem>
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="w-[160px] bg-background/50 border-border/50 rounded-lg h-9 text-xs"
        />
      </div>

      {/* Time estimate chips */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-xs text-muted-foreground mr-1">Estimate:</span>
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
              "px-2.5 py-1 rounded-lg text-xs font-medium transition-colors",
              estimateMinutes === preset.value
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="flex gap-2 pt-1">
        <Button
          type="submit"
          size="sm"
          disabled={!title.trim()}
          className="gap-1.5 bg-foreground hover:bg-foreground/90 text-background border-0 rounded-lg h-9 px-4 font-medium shadow-sm transition-colors"
        >
          <Zap className="size-3.5" />
          Add Task
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setExpanded(false)}
          className="rounded-lg h-9 text-muted-foreground hover:text-foreground"
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
