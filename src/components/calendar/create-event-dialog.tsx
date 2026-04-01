"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { supabase, getUserId } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Calendar, Clock, MapPin, Video } from "lucide-react";
import type { Workspace } from "@/types/database";

type CreateEventDialogProps = {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
  defaultDate?: Date;
  defaultStartHour?: number;
};

export function CreateEventDialog({
  open,
  onClose,
  onCreated,
  defaultDate,
  defaultStartHour,
}: CreateEventDialogProps) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [workspaceId, setWorkspaceId] = useState<string>("");
  const [meetingType, setMeetingType] = useState<string>("");
  const [allDay, setAllDay] = useState(false);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from("workspaces")
      .select("*")
      .then(({ data }) => {
        if (data) setWorkspaces(data);
      });
  }, []);

  useEffect(() => {
    if (open) {
      const d = defaultDate || new Date();
      setDate(d.toISOString().split("T")[0]);

      const hour = defaultStartHour ?? d.getHours();
      setStartTime(`${String(hour).padStart(2, "0")}:00`);
      setEndTime(`${String(hour + 1).padStart(2, "0")}:00`);

      setTitle("");
      setLocation("");
      setDescription("");
      setWorkspaceId("");
      setMeetingType("");
      setAllDay(false);
    }
  }, [open, defaultDate, defaultStartHour]);

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);

    const userId = await getUserId();
    if (!userId) return;

    const startDateTime = allDay
      ? `${date}T00:00:00`
      : `${date}T${startTime}:00`;
    const endDateTime = allDay
      ? `${date}T23:59:59`
      : `${date}T${endTime}:00`;

    await supabase.from("calendar_events").insert({
      user_id: userId,
      title: title.trim(),
      start_time: startDateTime,
      end_time: endDateTime,
      location: location || null,
      description: description || null,
      workspace_id: workspaceId || null,
      all_day: allDay,
      meeting_provider: meetingType || null,
      source: "local",
    });

    setSaving(false);
    onCreated?.();
    onClose();
  };

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="fixed inset-x-0 top-[10%] z-40 flex justify-center px-4">
        <div className="w-full max-w-md rounded-lg border border-border bg-card shadow-md overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
            <h2 className="text-sm font-semibold text-balance">New Event</h2>
            <button
              onClick={onClose}
              aria-label="Close dialog"
              className="rounded-lg p-1 hover:bg-accent transition-colors"
            >
              <X className="size-4 text-muted-foreground" />
            </button>
          </div>

          {/* Form */}
          <div className="p-5 space-y-4">
            {/* Title */}
            <div className="space-y-1.5">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Event title"
                className="text-base font-medium bg-transparent border-0 border-b border-border/50 rounded-none px-0 focus-visible:ring-0 focus-visible:border-indigo-500"
                autoFocus
              />
            </div>

            {/* Date + Time */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Calendar className="size-4 text-muted-foreground shrink-0" />
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="flex-1 bg-background/50 border-border/50 rounded-lg text-sm"
                />
              </div>

              {/* All day toggle */}
              <label className="flex items-center gap-2 pl-7 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allDay}
                  onChange={(e) => setAllDay(e.target.checked)}
                  className="rounded border-border"
                />
                <span className="text-xs text-muted-foreground">All day</span>
              </label>

              {!allDay && (
                <div className="flex items-center gap-3">
                  <Clock className="size-4 text-muted-foreground shrink-0" />
                  <Input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="flex-1 bg-background/50 border-border/50 rounded-lg text-sm"
                  />
                  <span className="text-xs text-muted-foreground">to</span>
                  <Input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="flex-1 bg-background/50 border-border/50 rounded-lg text-sm"
                  />
                </div>
              )}
            </div>

            {/* Location */}
            <div className="flex items-center gap-3">
              <MapPin className="size-4 text-muted-foreground shrink-0" />
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Add location"
                className="flex-1 bg-background/50 border-border/50 rounded-lg text-sm"
              />
            </div>

            {/* Meeting type */}
            <div className="flex items-center gap-3">
              <Video className="size-4 text-muted-foreground shrink-0" />
              <select
                value={meetingType}
                onChange={(e) => setMeetingType(e.target.value)}
                className="flex-1 bg-background/50 border border-border/50 rounded-lg text-sm px-3 py-2 text-foreground"
              >
                <option value="">No meeting link</option>
                <option value="zoom">Zoom</option>
                <option value="teams">Microsoft Teams</option>
                <option value="google_meet">Google Meet</option>
              </select>
            </div>

            {/* Workspace */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Workspace</Label>
              <div className="flex gap-2">
                <button
                  onClick={() => setWorkspaceId("")}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                    !workspaceId
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:bg-accent/50"
                  )}
                >
                  None
                </button>
                {workspaces.map((ws) => (
                  <button
                    key={ws.id}
                    onClick={() => setWorkspaceId(ws.id)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                      workspaceId === ws.id
                        ? "bg-accent text-foreground"
                        : "text-muted-foreground hover:bg-accent/50"
                    )}
                  >
                    {ws.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Description */}
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add description..."
              className="w-full bg-background/50 border border-border/50 rounded-lg text-sm px-3 py-2 resize-none h-16 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Footer */}
          <div className="px-5 py-4 border-t border-border/50 flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="rounded-lg"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!title.trim() || saving}
              className="rounded-lg bg-foreground text-background hover:bg-foreground/90 border-0 shadow-sm"
            >
              {saving ? "Creating..." : "Create Event"}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
