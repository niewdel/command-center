"use client";

import { cn } from "@/lib/utils";
import { Video, MapPin } from "lucide-react";
import type { CalendarEvent } from "@/types/database";

const SOURCE_COLORS: Record<string, string> = {
  local: "bg-indigo-500/20 border-indigo-500/40 text-indigo-300",
  google: "bg-blue-500/20 border-blue-500/40 text-blue-300",
  microsoft: "bg-sky-500/20 border-sky-500/40 text-sky-300",
  apple: "bg-gray-500/20 border-gray-500/40 text-gray-300",
};

export function EventBlock({
  event,
  onClick,
  compact = false,
}: {
  event: CalendarEvent;
  onClick?: () => void;
  compact?: boolean;
}) {
  const colorClass = SOURCE_COLORS[event.source] || SOURCE_COLORS.local;
  const startTime = new Date(event.start_time);
  const endTime = new Date(event.end_time);
  const durationMin = (endTime.getTime() - startTime.getTime()) / (1000 * 60);

  const timeStr = startTime.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  if (compact) {
    return (
      <button
        onClick={onClick}
        className={cn(
          "w-full text-left px-2 py-1 rounded-lg border text-xs truncate transition-colors hover:brightness-110",
          colorClass
        )}
      >
        <span className="font-medium">{timeStr}</span>{" "}
        <span className="opacity-80">{event.title}</span>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left px-2.5 py-1.5 rounded-lg border transition-all hover:brightness-110 hover:shadow-md overflow-hidden",
        colorClass
      )}
      style={{
        minHeight: Math.max(durationMin * 0.8, 24),
      }}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium truncate">{event.title}</p>
          {durationMin >= 30 && (
            <p className="text-[10px] opacity-70">{timeStr}</p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {event.meeting_url && (
            <Video className="h-3 w-3 opacity-60" />
          )}
          {event.location && (
            <MapPin className="h-3 w-3 opacity-60" />
          )}
        </div>
      </div>
    </button>
  );
}
