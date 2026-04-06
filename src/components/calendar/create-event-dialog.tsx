"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { CalendarConnection } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Loader2, Download } from "lucide-react";

type CreateEventDialogProps = {
  open: boolean;
  onClose: () => void;
  connections: CalendarConnection[];
  defaultDate?: Date;
  onCreated: () => void;
};

function generateIcsFile(event: {
  title: string;
  description: string;
  location: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
}): string {
  const formatDt = (iso: string) =>
    new Date(iso)
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "");
  const formatDate = (iso: string) =>
    new Date(iso).toISOString().split("T")[0].replace(/-/g, "");

  const uid = `${Date.now()}-${Math.random().toString(36).slice(2)}@commandcenter`;
  const now = formatDt(new Date().toISOString());

  let dtBlock: string;
  if (event.allDay) {
    dtBlock = `DTSTART;VALUE=DATE:${formatDate(event.startTime)}\nDTEND;VALUE=DATE:${formatDate(event.endTime)}`;
  } else {
    dtBlock = `DTSTART:${formatDt(event.startTime)}\nDTEND:${formatDt(event.endTime)}`;
  }

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Command Center//EN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    dtBlock,
    `SUMMARY:${event.title.replace(/[,;\\]/g, (m) => "\\" + m)}`,
    event.description
      ? `DESCRIPTION:${event.description.replace(/\n/g, "\\n").replace(/[,;\\]/g, (m) => "\\" + m)}`
      : "",
    event.location
      ? `LOCATION:${event.location.replace(/[,;\\]/g, (m) => "\\" + m)}`
      : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");
}

function downloadIcs(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function CreateEventDialog({
  open,
  onClose,
  connections,
  defaultDate,
  onCreated,
}: CreateEventDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [eventDate, setEventDate] = useState(
    (defaultDate || new Date()).toISOString().split("T")[0]
  );
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [allDay, setAllDay] = useState(false);
  const [connectionId, setConnectionId] = useState<string>("local");
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setLocation("");
    setEventDate((defaultDate || new Date()).toISOString().split("T")[0]);
    setStartTime("09:00");
    setEndTime("10:00");
    setAllDay(false);
    setConnectionId("local");
  };

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);

    const startIso = allDay
      ? new Date(`${eventDate}T00:00:00`).toISOString()
      : new Date(`${eventDate}T${startTime}:00`).toISOString();
    const endIso = allDay
      ? new Date(`${eventDate}T23:59:59`).toISOString()
      : new Date(`${eventDate}T${endTime}:00`).toISOString();

    // Get user_id
    const { data: settings } = await supabase
      .from("user_settings")
      .select("user_id")
      .limit(1)
      .single();

    const conn =
      connectionId !== "local"
        ? connections.find((c) => c.id === connectionId)
        : null;

    const eventData = {
      user_id: settings?.user_id,
      connection_id: conn?.id || null,
      workspace_id: conn?.workspace_id || null,
      title: title.trim(),
      description: description.trim() || null,
      location: location.trim() || null,
      start_time: startIso,
      end_time: endIso,
      all_day: allDay,
      timezone: "America/New_York",
      status: "confirmed",
      color: conn?.color || "#3b82f6",
      source: conn ? conn.provider : "local",
      is_read_only: false,
      attendees: [],
    };

    await supabase.from("calendar_events").insert(eventData);

    // Auto-download ICS for any connected calendar (until OAuth is set up)
    if (conn?.is_ics_feed) {
      const icsContent = generateIcsFile({
        title: title.trim(),
        description: description.trim(),
        location: location.trim(),
        startTime: startIso,
        endTime: endIso,
        allDay,
      });
      downloadIcs(icsContent, `${title.trim().replace(/\s+/g, "-")}.ics`);
    }

    setSaving(false);
    resetForm();
    onClose();
    onCreated();
  };

  const handleExportIcs = () => {
    if (!title.trim()) return;
    const startIso = allDay
      ? new Date(`${eventDate}T00:00:00`).toISOString()
      : new Date(`${eventDate}T${startTime}:00`).toISOString();
    const endIso = allDay
      ? new Date(`${eventDate}T23:59:59`).toISOString()
      : new Date(`${eventDate}T${endTime}:00`).toISOString();

    const icsContent = generateIcsFile({
      title: title.trim(),
      description: description.trim(),
      location: location.trim(),
      startTime: startIso,
      endTime: endIso,
      allDay,
    });
    downloadIcs(icsContent, `${title.trim().replace(/\s+/g, "-")}.ics`);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          resetForm();
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-[440px] max-h-[85dvh] overflow-y-auto bg-card border-border rounded-2xl shadow-md">
        <DialogHeader>
          <DialogTitle>New Event</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground uppercase">
              Title
            </Label>
            <Input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Meeting, lunch, call..."
              className="bg-background/50 border-border/50 rounded-lg"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground uppercase">
              Date
            </Label>
            <Input
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              className="bg-background/50 border-border/50 rounded-lg"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setAllDay(!allDay)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                allDay
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/50 text-muted-foreground hover:text-foreground"
              )}
            >
              All day
            </button>
          </div>

          {!allDay && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase">
                  Start
                </Label>
                <Input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="bg-background/50 border-border/50 rounded-lg"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase">
                  End
                </Label>
                <Input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="bg-background/50 border-border/50 rounded-lg"
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground uppercase">
              Location
            </Label>
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Address, Zoom link, etc."
              className="bg-background/50 border-border/50 rounded-lg"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground uppercase">
              Description
            </Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Notes, agenda, links..."
              rows={3}
              className="bg-background/50 border-border/50 rounded-lg resize-none"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground uppercase">
              Calendar
            </Label>
            <Select
              value={connectionId}
              onValueChange={(v) => v && setConnectionId(v)}
            >
              <SelectTrigger className="bg-background/50 border-border/50 rounded-lg">
                <SelectValue>
                  {connectionId === "local"
                    ? "Local (Command Center only)"
                    : connections.find((c) => c.id === connectionId)
                        ?.display_name || "Select calendar"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-popover border-border rounded-lg">
                <SelectItem value="local" className="rounded-lg">
                  Local (Command Center only)
                </SelectItem>
                {connections.map((conn) => (
                  <SelectItem
                    key={conn.id}
                    value={conn.id}
                    className="rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="size-2.5 rounded-full"
                        style={{ backgroundColor: conn.color }}
                      />
                      {conn.display_name || conn.account_email}
                      {conn.is_ics_feed && " (will download .ics)"}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleExportIcs}
            disabled={!title.trim()}
            className="gap-1.5 rounded-lg text-xs mr-auto"
          >
            <Download className="size-3" />
            Export .ics
          </Button>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                resetForm();
                onClose();
              }}
              className="rounded-lg"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!title.trim() || saving}
              className="bg-foreground hover:bg-foreground/90 text-background border-0 rounded-lg"
            >
              {saving ? (
                <>
                  <Loader2 className="size-3.5 animate-spin mr-1.5" />
                  Saving...
                </>
              ) : (
                "Create Event"
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
