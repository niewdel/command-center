"use client";

import { CalendarEvent } from "@/types/database";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Clock,
  MapPin,
  Video,
  Users,
  FileText,
  ExternalLink,
  Calendar,
} from "lucide-react";

type EventDetailProps = {
  event: CalendarEvent | null;
  open: boolean;
  onClose: () => void;
};

function formatEventDateTime(start: string, end: string, allDay: boolean) {
  const s = new Date(start);
  const e = new Date(end);

  const dateOpts: Intl.DateTimeFormatOptions = {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  };

  if (allDay) {
    return s.toLocaleDateString("en-US", dateOpts) + " — All day";
  }

  const timeOpts: Intl.DateTimeFormatOptions = {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  };

  const sameDay = s.toDateString() === e.toDateString();
  const dateStr = s.toLocaleDateString("en-US", dateOpts);
  const startTime = s.toLocaleTimeString("en-US", timeOpts);
  const endTime = e.toLocaleTimeString("en-US", timeOpts);

  if (sameDay) {
    return `${dateStr}\n${startTime} – ${endTime}`;
  }
  return `${dateStr} ${startTime} –\n${e.toLocaleDateString("en-US", dateOpts)} ${endTime}`;
}

function formatDuration(start: string, end: string) {
  const minutes =
    (new Date(end).getTime() - new Date(start).getTime()) / 60000;
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function getMeetingProviderLabel(
  provider: string | null
): string {
  switch (provider) {
    case "zoom":
      return "Zoom Meeting";
    case "teams":
      return "Microsoft Teams";
    case "google_meet":
      return "Google Meet";
    default:
      return "Video Call";
  }
}

export function EventDetail({ event, open, onClose }: EventDetailProps) {
  if (!event) return null;

  const dateTime = formatEventDateTime(
    event.start_time,
    event.end_time,
    event.all_day
  );
  const duration = event.all_day
    ? null
    : formatDuration(event.start_time, event.end_time);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[480px] max-h-[85dvh] overflow-y-auto bg-card border-border rounded-2xl shadow-md">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div
              className="w-1 h-8 rounded-full shrink-0 mt-0.5"
              style={{ backgroundColor: event.color || "#3b82f6" }}
            />
            <div>
              <DialogTitle className="text-lg leading-snug text-balance">
                {event.title}
              </DialogTitle>
              {event.status === "tentative" && (
                <span className="text-xs text-amber-400 font-medium mt-0.5 inline-block">
                  Tentative
                </span>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Date & Time */}
          <div className="flex items-start gap-3">
            <Calendar className="size-4 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="text-sm whitespace-pre-line">{dateTime}</p>
              {duration && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {duration}
                </p>
              )}
            </div>
          </div>

          {/* Meeting Link */}
          {event.meeting_url && (
            <div className="flex items-start gap-3">
              <Video className="size-4 text-muted-foreground mt-0.5 shrink-0" />
              <a
                href={event.meeting_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors text-sm font-medium"
              >
                {getMeetingProviderLabel(event.meeting_provider)}
                <ExternalLink className="size-3" />
              </a>
            </div>
          )}

          {/* Location */}
          {event.location && (
            <div className="flex items-start gap-3">
              <MapPin className="size-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-sm">{event.location}</p>
                {/* If location looks like an address, make it a maps link */}
                {/\d/.test(event.location) && (
                  <a
                    href={`https://maps.google.com/?q=${encodeURIComponent(event.location)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 mt-0.5"
                  >
                    Open in Maps
                    <ExternalLink className="size-2.5" />
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Attendees */}
          {event.attendees && event.attendees.length > 0 && (
            <div className="flex items-start gap-3">
              <Users className="size-4 text-muted-foreground mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase">
                  {event.attendees.length} Attendee
                  {event.attendees.length !== 1 ? "s" : ""}
                </p>
                <div className="space-y-0.5">
                  {event.attendees.map((att, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <div className="size-5 rounded-full bg-muted/50 flex items-center justify-center text-[10px] font-medium text-muted-foreground shrink-0">
                        {(att.name || att.email).charAt(0).toUpperCase()}
                      </div>
                      <span className="truncate">
                        {att.name || att.email}
                      </span>
                      {att.status && att.status !== "ACCEPTED" && att.status !== "NEEDS-ACTION" && (
                        <span className="text-[10px] text-muted-foreground capitalize">
                          {att.status.toLowerCase().replace("-", " ")}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Description */}
          {event.description && (
            <div className="flex items-start gap-3">
              <FileText className="size-4 text-muted-foreground mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-muted-foreground uppercase mb-1">
                  Details
                </p>
                <div className="text-sm text-muted-foreground whitespace-pre-wrap break-words rounded-lg border border-border/30 bg-background/30 p-3 max-h-[200px] overflow-y-auto">
                  {event.description}
                </div>
              </div>
            </div>
          )}

          {/* Source badge */}
          <div className="flex items-center gap-3 pt-2 border-t border-border/30">
            <Clock className="size-4 text-muted-foreground shrink-0" />
            <span className="text-xs text-muted-foreground capitalize">
              {event.source} calendar
              {event.is_read_only && " · Read-only"}
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
