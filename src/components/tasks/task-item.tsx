"use client";

import { useState, useRef } from "react";
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

// Hand-drawn checkmark SVG with stroke animation
function AnimatedCheck({ animate }: { animate: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path
        d="M4 12.5L9.5 18L20 6"
        className={animate ? "animate-check-draw" : ""}
        style={{
          strokeDasharray: 30,
          strokeDashoffset: animate ? 0 : 30,
        }}
      />
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
  const isOverdue =
    task.due_date && new Date(task.due_date) < new Date() && !isDone;
  const [completing, setCompleting] = useState(false);
  const [uncompleting, setUncompleting] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);

  const handleToggle = (checked: boolean) => {
    if (checked && !isDone) {
      // Animate completion
      setCompleting(true);

      // Phase 1: checkmark draws (300ms)
      // Phase 2: strikethrough sweeps + glow (300ms)
      // Phase 3: row flies off screen (400ms)
      setTimeout(() => {
        onToggle(task.id, true);
        setCompleting(false);
      }, 900);
    } else if (!checked && isDone) {
      // Animate uncomplete (slide back in)
      setUncompleting(true);
      onToggle(task.id, false);
      setTimeout(() => setUncompleting(false), 400);
    }
  };

  return (
    <div
      ref={rowRef}
      className={cn(
        "group flex items-center gap-3 border-b border-border/50 px-2 py-3.5 rounded overflow-hidden",
        "hover:bg-primary/[0.05] hover:border-b-primary/30",
        isDone && !uncompleting && "opacity-50",
        task.is_focus && !isDone && !completing && "border-l-2 border-l-primary pl-3 bg-primary/[0.04]",
        // Completion animation phases
        completing && "animate-task-complete",
        uncompleting && "animate-task-uncomplete",
      )}
      style={{
        transition: completing ? "none" : "all 0.2s ease",
      }}
    >
      {/* Custom checkbox */}
      <button
        onClick={() => handleToggle(!isDone)}
        className={cn(
          "relative shrink-0 size-5 rounded border-2 transition-all duration-200 flex items-center justify-center",
          isDone || completing
            ? "bg-primary border-primary text-primary-foreground scale-110"
            : "border-muted-foreground/50 hover:border-primary/70 hover:scale-105"
        )}
        style={completing ? {
          boxShadow: "0 0 12px 2px oklch(0.78 0.15 195 / 0.4)",
        } : undefined}
      >
        {(isDone || completing) && (
          <AnimatedCheck animate={completing} />
        )}
      </button>

      {showWorkspace && workspace?.color && (
        <span
          className={cn("size-2 rounded-full shrink-0 ring-1 ring-white/10", !workspace.color.startsWith("#") && workspace.color)}
          style={workspace.color.startsWith("#") ? { backgroundColor: workspace.color } : undefined}
        />
      )}

      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onEdit(task)}>
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              "text-sm font-medium truncate relative",
              (isDone || completing) && "text-muted-foreground",
              completing && "animate-strikethrough"
            )}
          >
            {task.title}
            {/* Animated strikethrough line */}
            {completing && (
              <span className="absolute left-0 top-1/2 h-[1.5px] bg-primary/60 animate-strike-sweep" />
            )}
          </span>
          {task.due_date && (
            <span
              className={cn(
                "text-xs shrink-0 font-mono tabular-nums",
                isOverdue ? "text-red-400 font-medium" : "text-muted-foreground"
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
            <Pencil className="size-3.5 mr-2" />
            Edit
          </DropdownMenuItem>
          {!isDone && (
            <DropdownMenuItem onClick={() => handleToggle(true)}>
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
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="size-3.5 mr-2" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
