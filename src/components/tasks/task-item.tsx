"use client";

import { Task, Workspace } from "@/types/database";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { formatMinutes } from "@/lib/capacity";
import { Calendar, Trash2, Pencil, Clock, Star } from "lucide-react";
import { Button } from "@/components/ui/button";

const priorityConfig = {
  none: { className: "", label: "" },
  low: {
    className: "bg-blue-500/15 text-blue-400 border-blue-500/20",
    label: "Low",
  },
  medium: {
    className: "bg-amber-500/15 text-amber-400 border-amber-500/20",
    label: "Medium",
  },
  high: {
    className: "bg-red-500/15 text-red-400 border-red-500/20",
    label: "High",
  },
};

const workspaceConfig: Record<string, { className: string; dot: string }> = {
  niewdel: {
    className: "bg-violet-500/15 text-violet-400 border-violet-500/20",
    dot: "bg-violet-500",
  },
  i10: {
    className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
    dot: "bg-emerald-500",
  },
  personal: {
    className: "bg-amber-500/15 text-amber-400 border-amber-500/20",
    dot: "bg-amber-500",
  },
};

type TaskItemProps = {
  task: Task;
  workspace?: Workspace;
  onToggle: (id: string, done: boolean) => void;
  onDelete: (id: string) => void;
  onEdit: (task: Task) => void;
  showWorkspace?: boolean;
};

export function TaskItem({
  task,
  workspace,
  onToggle,
  onDelete,
  onEdit,
  showWorkspace = true,
}: TaskItemProps) {
  const isDone = task.status === "done";
  const isOverdue =
    task.due_date && new Date(task.due_date) < new Date() && !isDone;

  return (
    <div
      className={cn(
        "group flex items-start gap-3 rounded-xl border border-border/50 bg-card/50 p-4 transition-all duration-200",
        "hover:bg-card hover:border-border hover:shadow-lg hover:shadow-black/10",
        isDone && "opacity-40",
        isOverdue && "border-red-500/30 bg-red-500/5",
        task.is_focus &&
          !isDone &&
          "border-indigo-500/30 bg-indigo-500/5 ring-1 ring-indigo-500/10"
      )}
    >
      <Checkbox
        checked={isDone}
        onCheckedChange={(checked) => onToggle(task.id, !!checked)}
        className={cn(
          "mt-0.5 border-muted-foreground/40 data-[state=checked]:bg-primary data-[state=checked]:border-primary",
          "transition-colors duration-200"
        )}
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {task.is_focus && !isDone && (
            <Star className="h-3.5 w-3.5 text-indigo-400 fill-indigo-400 shrink-0" />
          )}
          <span
            className={cn(
              "text-sm font-medium leading-tight",
              isDone && "line-through text-muted-foreground"
            )}
          >
            {task.title}
          </span>
        </div>

        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {showWorkspace && workspace && (
            <Badge
              variant="outline"
              className={cn(
                "text-[11px] font-medium px-2 py-0 h-5 border rounded-md",
                workspaceConfig[workspace.slug]?.className
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full mr-1.5",
                  workspaceConfig[workspace.slug]?.dot
                )}
              />
              {workspace.name}
            </Badge>
          )}
          {task.priority !== "none" && (
            <Badge
              variant="outline"
              className={cn(
                "text-[11px] font-medium px-2 py-0 h-5 border rounded-md",
                priorityConfig[task.priority].className
              )}
            >
              {priorityConfig[task.priority].label}
            </Badge>
          )}
          {task.estimated_minutes && (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Clock className="h-3 w-3" />
              {formatMinutes(task.estimated_minutes)}
            </span>
          )}
          {task.source !== "manual" && (
            <Badge
              variant="outline"
              className="text-[11px] font-medium px-2 py-0 h-5 border rounded-md border-border/50 text-muted-foreground"
            >
              {task.source}
            </Badge>
          )}
          {task.due_date && (
            <span
              className={cn(
                "flex items-center gap-1 text-[11px] text-muted-foreground",
                isOverdue && "text-red-400 font-medium"
              )}
            >
              <Calendar className="h-3 w-3" />
              {isOverdue && "Overdue: "}
              {new Date(task.due_date).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </span>
          )}
        </div>
      </div>

      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-all duration-200">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent"
          onClick={() => onEdit(task)}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
          onClick={() => onDelete(task.id)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
