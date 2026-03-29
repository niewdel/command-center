"use client";

import { cn } from "@/lib/utils";
import { List, Columns3 } from "lucide-react";

type ViewToggleProps = {
  view: "list" | "kanban";
  onChange: (view: "list" | "kanban") => void;
};

export function ViewToggle({ view, onChange }: ViewToggleProps) {
  return (
    <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-0.5">
      <button
        onClick={() => onChange("list")}
        className={cn(
          "p-1.5 rounded-md transition-all duration-200",
          view === "list"
            ? "bg-background shadow-sm text-foreground"
            : "text-muted-foreground hover:text-foreground"
        )}
        title="List view"
      >
        <List className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={() => onChange("kanban")}
        className={cn(
          "p-1.5 rounded-md transition-all duration-200",
          view === "kanban"
            ? "bg-background shadow-sm text-foreground"
            : "text-muted-foreground hover:text-foreground"
        )}
        title="Kanban view"
      >
        <Columns3 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
