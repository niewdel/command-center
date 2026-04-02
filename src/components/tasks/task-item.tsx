"use client";

import { useState } from "react";
import { Task, Workspace } from "@/types/database";
import { cn } from "@/lib/utils";
import { MoreHorizontal, Pencil, Trash2, Star, ArrowRight } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type TaskItemProps = {
  task: Task;
  workspace?: Workspace;
  onToggle: (id: string, done: boolean) => void;
  onDelete: (id: string) => void;
  onEdit: (task: Task) => void;
  showWorkspace?: boolean;
};

function AnimatedCheck() {
  return (
    <svg viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12.5L9.5 18L20 6" className="animate-check-draw" style={{ strokeDasharray: 30, strokeDashoffset: 30 }} />
    </svg>
  );
}

export function TaskItem({
  task,
  workspace,
  onToggle,
  onDelete,
  onEdit,
  showWorkspace = true,
}: TaskItemProps) {
  const isDone = task.status === "done";
  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && !isDone;
  const [completing, setCompleting] = useState(false);
  const [hidden, setHidden] = useState(false);

  const handleToggle = (checked: boolean) => {
    if (checked && !isDone) {
      setCompleting(true);
      // After animation plays, hide the row and fire the toggle
      setTimeout(() => {
        setHidden(true);
        onToggle(task.id, true);
        // Don't reset completing — row stays hidden until unmounted by parent re-render
      }, 750);
    } else {
      onToggle(task.id, checked);
    }
  };

  // Hidden after completion animation — prevents flash-back on refetch
  if (hidden) return null;

  return (
    <div
      className={cn(
        "group flex items-center gap-3 border-b border-border/50 px-2 py-3.5 rounded",
        !completing && "transition-colors hover:bg-primary/[0.05] hover:border-b-primary/30",
        isDone && !completing && "opacity-50",
        task.is_focus && !isDone && !completing && "border-l-2 border-l-primary pl-3 bg-primary/[0.04]",
        completing && "task-completing",
      )}
    >
      {/* Checkbox */}
      <button
        onClick={() => handleToggle(!isDone)}
        disabled={completing}
        className={cn(
          "relative shrink-0 size-[18px] rounded-[4px] border-2 flex items-center justify-center transition-colors duration-200",
          isDone || completing
            ? "bg-primary border-primary text-primary-foreground"
            : "border-muted-foreground/50 hover:border-primary/70"
        )}
      >
        {isDone && !completing && (
          <svg viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12.5L9.5 18L20 6" />
          </svg>
        )}
        {completing && <AnimatedCheck />}
      </button>

      {/* Workspace dot */}
      {showWorkspace && workspace?.color && (
        <span
          className={cn("size-2 rounded-full shrink-0 ring-1 ring-white/10", !workspace.color.startsWith("#") && workspace.color)}
          style={workspace.color.startsWith("#") ? { backgroundColor: workspace.color } : undefined}
        />
      )}

      {/* Content */}
      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => !completing && onEdit(task)}>
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              "text-sm font-medium truncate",
              isDone && "line-through text-muted-foreground",
              completing && "task-title-completing"
            )}
          >
            {task.title}
          </span>
          {task.due_date && (
            <span className={cn("text-xs shrink-0 font-mono tabular-nums", isOverdue ? "text-red-400 font-medium" : "text-muted-foreground")}>
              {new Date(task.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </span>
          )}
        </div>
        {showWorkspace && workspace && (
          <span className="text-xs text-muted-foreground mt-0.5 block truncate">{workspace.name}</span>
        )}
      </div>

      {/* Actions */}
      {!completing && (
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              "inline-flex items-center justify-center size-8 shrink-0 rounded text-muted-foreground hover:text-foreground hover:bg-primary/10 transition-colors",
              "opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100",
              "transition-opacity"
            )}
            aria-label="Task actions"
          >
            <MoreHorizontal className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-36">
            <DropdownMenuItem onClick={() => onEdit(task)}>
              <Pencil className="size-3.5 mr-2" />Edit
            </DropdownMenuItem>
            {!isDone && (
              <DropdownMenuItem onClick={() => handleToggle(true)}>
                <ArrowRight className="size-3.5 mr-2" />Complete
              </DropdownMenuItem>
            )}
            {task.is_focus && (
              <DropdownMenuItem onClick={() => onEdit(task)}>
                <Star className="size-3.5 mr-2" />Remove focus
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => onDelete(task.id)} className="text-destructive focus:text-destructive">
              <Trash2 className="size-3.5 mr-2" />Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
