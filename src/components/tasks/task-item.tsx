"use client";

import { Task, Workspace } from "@/types/database";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { MoreHorizontal, Pencil, Trash2, Star, ArrowRight } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

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
        "group flex items-center gap-3 border-b border-border px-1 py-2.5 transition-colors",
        isDone && "opacity-60",
        task.is_focus && !isDone && "border-l-2 border-l-primary pl-2.5"
      )}
    >
      <Checkbox
        checked={isDone}
        onCheckedChange={(checked) => onToggle(task.id, !!checked)}
        className="shrink-0 border-muted-foreground/40 data-[state=checked]:bg-primary data-[state=checked]:border-primary transition-colors"
      />

      {showWorkspace && workspace?.color && (
        <span
          className={cn("size-1.5 rounded-full shrink-0", !workspace.color.startsWith("#") && workspace.color)}
          style={workspace.color.startsWith("#") ? { backgroundColor: workspace.color } : undefined}
        />
      )}

      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onEdit(task)}>
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              "text-sm font-medium truncate",
              isDone && "line-through text-muted-foreground"
            )}
          >
            {task.title}
          </span>
          {task.due_date && (
            <span
              className={cn(
                "text-xs text-muted-foreground shrink-0 tabular-nums",
                isOverdue && "text-red-400"
              )}
            >
              {new Date(task.due_date).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </span>
          )}
        </div>
        {showWorkspace && workspace && (
          <span className="text-xs text-muted-foreground mt-0.5 block truncate">
            {workspace.name}
          </span>
        )}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            "inline-flex items-center justify-center size-7 shrink-0 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors",
            "opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100",
            "transition-opacity"
          )}
          aria-label="Task actions"
        >
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem onClick={() => onEdit(task)}>
            <Pencil className="size-3.5 mr-2" />
            Edit
          </DropdownMenuItem>
          {!isDone && (
            <DropdownMenuItem onClick={() => onToggle(task.id, true)}>
              <ArrowRight className="size-3.5 mr-2" />
              Complete
            </DropdownMenuItem>
          )}
          {task.is_focus && (
            <DropdownMenuItem onClick={() => onEdit(task)}>
              <Star className="size-3.5 mr-2" />
              Remove focus
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onClick={() => onDelete(task.id)}
            className="text-red-400 focus:text-red-400"
          >
            <Trash2 className="size-3.5 mr-2" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
