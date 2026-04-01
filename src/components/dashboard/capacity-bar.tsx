"use client";

import { cn } from "@/lib/utils";
import { CapacityInfo, formatMinutes } from "@/lib/capacity";

type CapacityBarProps = {
  capacity: CapacityInfo;
};

const levelColor = {
  green: "bg-emerald-500",
  yellow: "bg-amber-500",
  red: "bg-red-500",
};

const levelText = {
  green: "text-emerald-400",
  yellow: "text-amber-400",
  red: "text-red-400",
};

export function CapacityBar({ capacity }: CapacityBarProps) {
  const barWidth = Math.min(capacity.percentage, 100);

  return (
    <div className="space-y-1">
      <div className="h-1 rounded-full bg-muted/50 overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-500", levelColor[capacity.level])}
          style={{ width: `${barWidth}%` }}
        />
      </div>
      <div className="flex items-center justify-between">
        <span className={cn("text-xs tabular-nums", levelText[capacity.level])}>
          {formatMinutes(capacity.estimatedMinutes)} / {formatMinutes(capacity.availableMinutes)}
        </span>
        {capacity.tasksWithoutEstimates > 0 && (
          <span className="text-xs text-muted-foreground">
            {capacity.tasksWithoutEstimates} unestimated
          </span>
        )}
      </div>
    </div>
  );
}
