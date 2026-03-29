"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import {
  X,
  Clock,
  MapPin,
  Video,
  Trash2,
  ExternalLink,
  Briefcase,
} from "lucide-react";
import type { CalendarEvent, Workspace } from "@/types/database";

type EventDetailSheetProps = {
  event: CalendarEvent | null;
  onClose: () => void;
  onDeleted?: () => void;
};

export function EventDetailSheet({
  event,
  onClose,
  onDeleted,
}: EventDetailSheetProps) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (event?.workspace_id) {
      supabase
        .from("workspaces")
        .select("*")
        .eq("id", event.workspace_id)
        .single()
        .then(({ data }) => setWorkspace(data));
    } else {
      setWorkspace(null);
    }
  }, [event?.workspace_id]);

  if (!event) return null;

  const startTime = new Date(event.start_time);
  const endTime = new Date(event.end_time);

  const dateStr = startTime.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const timeStr = event.all_day
    ? "All day"
    : `${startTime.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      })} - ${endTime.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      })}`;

  const handleDelete = async () => {
    setDeleting(true);
    await supabase.from("calendar_events").delete().eq("id", event.id);
    setDeleting(false);
    onDeleted?.();
    onClose();
  };

  return (
    <>
      <div
        className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="fixed inset-y-0 right-0 z-40 w-full max-w-sm">
        <div className="h-full bg-card border-l border-border shadow-md flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
            <div className="flex items-center gap-2">
              {event.source !== "local" && (
                <span className="text-[10px] font-medium uppercase px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                  {event.source}
                </span>
              )}
              {event.is_read_only && (
                <span className="text-[10px] text-muted-foreground/60">
                  Read-only
                </span>
              )}
            </div>
            <button
              onClick={onClose}
              aria-label="Close event details"
              className="rounded-lg p-1 hover:bg-accent transition-colors"
            >
              <X className="size-4 text-muted-foreground" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            <h2 className="text-xl font-semibold text-balance">{event.title}</h2>

            {/* Time */}
            <div className="flex items-start gap-3">
              <Clock className="size-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-sm text-pretty">{dateStr}</p>
                <p className="text-sm text-muted-foreground text-pretty">{timeStr}</p>
              </div>
            </div>

            {/* Location */}
            {event.location && (
              <div className="flex items-start gap-3">
                <MapPin className="size-4 text-muted-foreground mt-0.5 shrink-0" />
                <p className="text-sm text-pretty">{event.location}</p>
              </div>
            )}

            {/* Meeting link */}
            {event.meeting_url && (
              <div className="flex items-start gap-3">
                <Video className="size-4 text-muted-foreground mt-0.5 shrink-0" />
                <a
                  href={event.meeting_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                >
                  Join{" "}
                  {event.meeting_provider === "zoom"
                    ? "Zoom"
                    : event.meeting_provider === "teams"
                    ? "Teams"
                    : "Meeting"}
                  <ExternalLink className="size-3" />
                </a>
              </div>
            )}

            {/* Workspace */}
            {workspace && (
              <div className="flex items-start gap-3">
                <Briefcase className="size-4 text-muted-foreground mt-0.5 shrink-0" />
                <p className="text-sm text-pretty">{workspace.name}</p>
              </div>
            )}

            {/* Description */}
            {event.description && (
              <div className="pt-2 border-t border-border/50">
                <p className="text-sm text-muted-foreground whitespace-pre-wrap text-pretty">
                  {event.description}
                </p>
              </div>
            )}

            {/* Attendees */}
            {event.attendees && event.attendees.length > 0 && (
              <div className="pt-2 border-t border-border/50">
                <p className="text-xs font-medium text-muted-foreground text-pretty mb-2">
                  Attendees
                </p>
                <div className="space-y-1">
                  {event.attendees.map((a, i) => (
                    <p key={i} className="text-sm text-pretty">
                      {a.name || a.email}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          {!event.is_read_only && (
            <div className="px-5 py-4 border-t border-border/50">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDelete}
                disabled={deleting}
                className="w-full gap-2 rounded-lg text-red-400 border-red-500/30 hover:bg-red-500/10 hover:text-red-300"
              >
                <Trash2 className="size-3.5" />
                {deleting ? "Deleting..." : "Delete Event"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
