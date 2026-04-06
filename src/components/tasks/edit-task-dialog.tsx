"use client";

import { useState, useEffect } from "react";
import { Task, Workspace, Project } from "@/types/database";
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
import { ESTIMATE_PRESETS } from "@/lib/capacity";
import { parseRecurrenceRule, serializeRecurrenceRule, describeRecurrence } from "@/lib/recurrence";
import type { RecurrenceRule } from "@/lib/recurrence";
import { cn } from "@/lib/utils";

type EditTaskDialogProps = {
  task: Task | null;
  workspaces: Workspace[];
  projects?: Project[];
  open: boolean;
  onClose: () => void;
  onSave: (id: string, updates: Partial<Task>) => void;
};

export function EditTaskDialog({
  task,
  workspaces,
  projects,
  open,
  onClose,
  onSave,
}: EditTaskDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [workspaceId, setWorkspaceId] = useState("");
  const [priority, setPriority] = useState("none");
  const [status, setStatus] = useState("todo");
  const [dueDate, setDueDate] = useState("");
  const [plannedDate, setPlannedDate] = useState("");
  const [estimateMinutes, setEstimateMinutes] = useState<number | null>(null);
  const [projectId, setProjectId] = useState<string>("none");
  const [isRecurring, setIsRecurring] = useState(false);
  const [recFrequency, setRecFrequency] = useState<RecurrenceRule["frequency"]>("daily");
  const [recInterval, setRecInterval] = useState(1);
  const [recDaysOfWeek, setRecDaysOfWeek] = useState<number[]>([]);

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || "");
      setWorkspaceId(task.workspace_id);
      setPriority(task.priority);
      setStatus(task.status);
      setDueDate(task.due_date || "");
      setPlannedDate(task.planned_date || "");
      setEstimateMinutes(task.estimated_minutes);
      setProjectId(task.project_id || "none");
      setIsRecurring(task.is_recurring);
      const rule = parseRecurrenceRule(task.recurrence_rule);
      if (rule) {
        setRecFrequency(rule.frequency);
        setRecInterval(rule.interval);
        setRecDaysOfWeek(rule.days_of_week || []);
      } else {
        setRecFrequency("daily");
        setRecInterval(1);
        setRecDaysOfWeek([]);
      }
    }
  }, [task]);

  const handleSave = () => {
    if (!task || !title.trim()) return;
    const recurrenceRule = isRecurring
      ? serializeRecurrenceRule({
          frequency: recFrequency,
          interval: recInterval,
          ...(recFrequency === "weekly" && recDaysOfWeek.length > 0
            ? { days_of_week: recDaysOfWeek }
            : {}),
        })
      : null;

    onSave(task.id, {
      title: title.trim(),
      description: description || null,
      workspace_id: workspaceId,
      project_id: projectId !== "none" ? projectId : null,
      priority: priority as Task["priority"],
      status: status as Task["status"],
      due_date: dueDate || null,
      planned_date: plannedDate || null,
      estimated_minutes: estimateMinutes,
      is_recurring: isRecurring,
      recurrence_rule: recurrenceRule,
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[460px] max-h-[85dvh] overflow-y-auto bg-card border-border rounded-2xl shadow-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Edit Task</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="title" className="text-xs font-medium text-muted-foreground uppercase">
              Title
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-background/50 border-border/50 rounded-lg focus-visible:ring-primary/50"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description" className="text-xs font-medium text-muted-foreground uppercase">
              Description
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="bg-background/50 border-border/50 rounded-lg focus-visible:ring-primary/50 resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase">
                Workspace
              </Label>
              <Select value={workspaceId} onValueChange={(v) => v && setWorkspaceId(v)}>
                <SelectTrigger className="bg-background/50 border-border/50 rounded-lg">
                  <SelectValue placeholder="Select workspace">
                    {workspaces.find((ws) => ws.id === workspaceId)?.name ?? "Select workspace"}
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
          {projects && projects.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase">
                Project
              </Label>
              <Select value={projectId} onValueChange={(v) => setProjectId(v || "none")}>
                <SelectTrigger className="bg-background/50 border-border/50 rounded-lg">
                  <SelectValue placeholder="No project" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border rounded-lg">
                  <SelectItem value="none" className="rounded-lg">No project</SelectItem>
                  {projects
                    .filter((p) => p.workspace_id === workspaceId || p.id === projectId)
                    .map((p) => (
                      <SelectItem key={p.id} value={p.id} className="rounded-lg">
                        {p.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase">
                Status
              </Label>
              <Select value={status} onValueChange={(v) => v && setStatus(v)}>
                <SelectTrigger className="bg-background/50 border-border/50 rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border rounded-lg">
                  <SelectItem value="todo" className="rounded-lg">To Do</SelectItem>
                  <SelectItem value="in_progress" className="rounded-lg">In Progress</SelectItem>
                  <SelectItem value="done" className="rounded-lg">Done</SelectItem>
                </SelectContent>
              </Select>
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
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground uppercase">
              Planned Date
            </Label>
            <Input
              type="date"
              value={plannedDate}
              onChange={(e) => setPlannedDate(e.target.value)}
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

          {/* Recurrence */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground uppercase">
              Repeat
            </Label>
            <button
              type="button"
              onClick={() => setIsRecurring(!isRecurring)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                isRecurring
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {isRecurring
                ? describeRecurrence({ frequency: recFrequency, interval: recInterval, days_of_week: recDaysOfWeek })
                : "Does not repeat"}
            </button>
            {isRecurring && (
              <div className="space-y-3 rounded-lg border border-border/50 bg-background/50 p-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Frequency</Label>
                    <Select value={recFrequency} onValueChange={(v) => setRecFrequency(v as RecurrenceRule["frequency"])}>
                      <SelectTrigger className="bg-background/50 border-border/50 rounded-lg h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border-border rounded-lg">
                        <SelectItem value="daily" className="rounded-lg text-xs">Daily</SelectItem>
                        <SelectItem value="weekly" className="rounded-lg text-xs">Weekly</SelectItem>
                        <SelectItem value="monthly" className="rounded-lg text-xs">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Every</Label>
                    <Input
                      type="number"
                      min={1}
                      max={30}
                      value={recInterval}
                      onChange={(e) => setRecInterval(Math.max(1, parseInt(e.target.value) || 1))}
                      className="bg-background/50 border-border/50 rounded-lg h-8 text-xs"
                    />
                  </div>
                </div>
                {recFrequency === "weekly" && (
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">On days</Label>
                    <div className="flex gap-1">
                      {["S", "M", "T", "W", "T", "F", "S"].map((day, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() =>
                            setRecDaysOfWeek((prev) =>
                              prev.includes(i) ? prev.filter((d) => d !== i) : [...prev, i].sort()
                            )
                          }
                          className={cn(
                            "size-7 rounded-md text-[10px] font-medium transition-colors",
                            recDaysOfWeek.includes(i)
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted/50 text-muted-foreground hover:bg-muted"
                          )}
                        >
                          {day}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button
            variant="ghost"
            onClick={onClose}
            className="rounded-lg text-muted-foreground hover:text-foreground"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!title.trim()}
            className="bg-foreground hover:bg-foreground/90 text-background border-0 rounded-lg shadow-sm"
          >
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
