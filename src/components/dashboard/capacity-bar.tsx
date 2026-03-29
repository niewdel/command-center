"use client";

import { cn } from "@/lib/utils";
import { CapacityInfo, formatMinutes } from "@/lib/capacity";
import { Clock, AlertTriangle } from "lucide-react";

type CapacityBarProps = {
  capacity: CapacityInfo;
};

const levelConfig = {
  green: {
    bar: "bg-emerald-500",
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    border: "border-emerald-500/20",
  },
  yellow: {
    bar: "bg-amber-500",
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    border: "border-amber-500/20",
  },
  red: {
    bar: "bg-red-500",
    bg: "bg-red-500/10",
    text: "text-red-400",
    border: "border-red-500/20",
  },
};

export function CapacityBar({ capacity }: CapacityBarProps) {
  const config = levelConfig[capacity.level];
  const barWidth = Math.min(capacity.percentage, 100);

  return (
    <div
      className={cn(
        "rounded-lg border p-4 space-y-3",
        config.border,
        config.bg
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className={cn("size-4", config.text)} />
          <span className="text-sm font-medium">Today&apos;s Capacity</span>
        </div>
        <div className="flex items-center gap-2">
          {capacity.level === "red" && (
            <AlertTriangle className="size-3.5 text-red-400" />
          )}
          <span className={cn("text-sm font-semibold", config.text)}>
            {formatMinutes(capacity.estimatedMinutes)} /{" "}
            {formatMinutes(capacity.availableMinutes)}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2.5 rounded-full bg-muted/50 overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-500", config.bar)}
          style={{ width: `${barWidth}%` }}
        />
      </div>

      {/* Details */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {capacity.remainingMinutes > 0
            ? `${formatMinutes(capacity.remainingMinutes)} available`
            : `${formatMinutes(Math.abs(capacity.remainingMinutes))} overbooked`}
        </span>
        {capacity.tasksWithoutEstimates > 0 && (
          <span className="text-amber-400/70">
            {capacity.tasksWithoutEstimates} task
            {capacity.tasksWithoutEstimates > 1 ? "s" : ""} unestimated
          </span>
        )}
      </div>
    </div>
  );
}
