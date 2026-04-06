"use client";

import { cn } from "@/lib/utils";
import { CapacityInfo, CapacityWithEventsInfo, formatMinutes } from "@/lib/capacity";

type CapacityBarProps = {
  capacity: CapacityInfo | CapacityWithEventsInfo;
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

function hasMeetings(
  cap: CapacityInfo | CapacityWithEventsInfo
): cap is CapacityWithEventsInfo {
  return "meetingMinutes" in cap && cap.meetingMinutes > 0;
}

export function CapacityBar({ capacity }: CapacityBarProps) {
  const withMeetings = hasMeetings(capacity);
  const meetingPercent = withMeetings
    ? Math.min(
        (capacity.meetingMinutes / capacity.availableMinutes) * 100,
        100
      )
    : 0;
  const taskPercent = withMeetings
    ? Math.min(
        (capacity.estimatedMinutes / capacity.availableMinutes) * 100,
        100 - meetingPercent
      )
    : Math.min(capacity.percentage, 100);

  return (
    <div className="space-y-1">
      <div className="h-1.5 rounded-full bg-muted/50 overflow-hidden flex">
        {withMeetings && meetingPercent > 0 && (
          <div
            className="h-full bg-blue-500/70 transition-all duration-500"
            style={{ width: `${meetingPercent}%` }}
          />
        )}
        <div
          className={cn(
            "h-full transition-all duration-500",
            withMeetings && meetingPercent > 0
              ? levelColor[capacity.level]
              : cn("rounded-full", levelColor[capacity.level])
          )}
          style={{ width: `${taskPercent}%` }}
        />
      </div>
      <div className="flex items-center justify-between">
        <span className={cn("text-xs tabular-nums", levelText[capacity.level])}>
          {withMeetings ? (
            <>
              {formatMinutes(capacity.meetingMinutes)}{" "}
              <span className="text-blue-400">meetings</span>
              {" + "}
              {formatMinutes(capacity.estimatedMinutes)}{" "}
              <span className={levelText[capacity.level]}>tasks</span>
              {" / "}
              {formatMinutes(capacity.availableMinutes)}
            </>
          ) : (
            <>
              {formatMinutes(capacity.estimatedMinutes)} /{" "}
              {formatMinutes(capacity.availableMinutes)}
            </>
          )}
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
