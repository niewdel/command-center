"use client";

import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useDroppable } from "@dnd-kit/core";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Task, Workspace } from "@/types/database";
import { cn } from "@/lib/utils";
import { formatMinutes } from "@/lib/capacity";
import { GripVertical, Clock, Repeat } from "lucide-react";

type KanbanBoardProps = {
  tasks: Task[];
  workspaceMap?: Record<string, Workspace>;
  onStatusChange: (taskId: string, newStatus: Task["status"]) => void;
  onEdit: (task: Task) => void;
  showWorkspace?: boolean;
};

const columns: { id: Task["status"]; label: string; color: string; borderColor: string }[] = [
  { id: "todo", label: "Backlog", color: "text-muted-foreground", borderColor: "border-t-muted-foreground/30" },
  { id: "in_progress", label: "In Progress", color: "text-blue-400", borderColor: "border-t-blue-500" },
  { id: "done", label: "Done", color: "text-emerald-400", borderColor: "border-t-emerald-500" },
];

const priorityColors: Record<string, string> = {
  high: "bg-red-500",
  medium: "bg-amber-500",
  low: "bg-blue-500",
  none: "bg-transparent",
};


function KanbanCard({
  task,
  workspace,
  showWorkspace,
  onEdit,
  isDragOverlay,
}: {
  task: Task;
  workspace?: Workspace;
  showWorkspace?: boolean;
  onEdit: (task: Task) => void;
  isDragOverlay?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { task },
  });

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  return (
    <div
      ref={isDragOverlay ? undefined : setNodeRef}
      style={isDragOverlay ? undefined : style}
      className={cn(
        "rounded-lg border border-border/50 bg-card p-3 space-y-2 cursor-grab active:cursor-grabbing transition-shadow",
        isDragging && "opacity-30",
        isDragOverlay && "shadow-md rotate-2",
        !isDragging && "hover:border-border hover:shadow-md"
      )}
      onClick={() => !isDragging && onEdit(task)}
    >
      <div className="flex items-start gap-2">
        <div
          {...(isDragOverlay ? {} : { ...attributes, ...listeners })}
          className="mt-0.5 text-muted-foreground/40 hover:text-muted-foreground shrink-0"
        >
          <GripVertical className="size-3.5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {task.priority !== "none" && (
              <div className={cn("size-1.5 rounded-full shrink-0", priorityColors[task.priority])} />
            )}
            <p className={cn("text-xs font-medium truncate text-pretty", task.status === "done" && "line-through opacity-60")}>
              {task.title}
            </p>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 pl-5">
        {showWorkspace && workspace && (
          <span className="text-[10px] font-medium text-muted-foreground">
            {workspace.name}
          </span>
        )}
        {task.estimated_minutes && (
          <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground/60">
            <Clock className="size-2.5" />
            {formatMinutes(task.estimated_minutes)}
          </span>
        )}
        {task.is_recurring && (
          <Repeat className="size-2.5 text-muted-foreground/60" />
        )}
        {task.due_date && (
          <span
            className={cn(
              "text-[10px]",
              new Date(task.due_date) < new Date(new Date().toISOString().split("T")[0])
                ? "text-red-400"
                : "text-muted-foreground/60"
            )}
          >
            {new Date(task.due_date + "T00:00:00").toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </span>
        )}
      </div>
    </div>
  );
}

function Column({
  column,
  tasks,
  workspaceMap,
  showWorkspace,
  onEdit,
}: {
  column: (typeof columns)[number];
  tasks: Task[];
  workspaceMap?: Record<string, Workspace>;
  showWorkspace?: boolean;
  onEdit: (task: Task) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex-1 min-w-[220px] rounded-lg border border-border/30 bg-muted/20 overflow-hidden transition-colors",
        isOver && "bg-primary/5 border-primary/30"
      )}
    >
      <div className={cn("border-t-2 px-3 py-2.5", column.borderColor)}>
        <div className="flex items-center justify-between">
          <span className={cn("text-xs font-semibold uppercase", column.color)}>
            {column.label}
          </span>
          <span className="text-[10px] text-muted-foreground/60 font-medium">
            {tasks.length}
          </span>
        </div>
      </div>
      <div className="p-2 space-y-2 min-h-[100px]">
        {tasks.map((task) => (
          <KanbanCard
            key={task.id}
            task={task}
            workspace={workspaceMap?.[task.workspace_id]}
            showWorkspace={showWorkspace}
            onEdit={onEdit}
          />
        ))}
        {tasks.length === 0 && (
          <div className="text-center py-8">
            <p className="text-[11px] text-muted-foreground/40 text-pretty">
              Drop tasks here
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export function KanbanBoard({
  tasks,
  workspaceMap,
  onStatusChange,
  onEdit,
  showWorkspace = true,
}: KanbanBoardProps) {
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find((t) => t.id === event.active.id);
    setActiveTask(task || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const newStatus = over.id as Task["status"];
    const task = tasks.find((t) => t.id === taskId);

    if (task && task.status !== newStatus) {
      onStatusChange(taskId, newStatus);
    }
  };

  const tasksByStatus = columns.map((col) => ({
    ...col,
    tasks: tasks.filter((t) => t.status === col.id),
  }));

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-3 overflow-x-auto pb-4">
        {tasksByStatus.map((col) => (
          <Column
            key={col.id}
            column={col}
            tasks={col.tasks}
            workspaceMap={workspaceMap}
            showWorkspace={showWorkspace}
            onEdit={onEdit}
          />
        ))}
      </div>

      <DragOverlay>
        {activeTask && (
          <KanbanCard
            task={activeTask}
            workspace={workspaceMap?.[activeTask.workspace_id]}
            showWorkspace={showWorkspace}
            onEdit={() => {}}
            isDragOverlay
          />
        )}
      </DragOverlay>
    </DndContext>
  );
}
