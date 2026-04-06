"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { CalendarConnection } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  Calendar,
  Plus,
  Trash2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";

const CALENDAR_COLORS = [
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#06b6d4", // cyan
];

export function CalendarConnections() {
  const [connections, setConnections] = useState<CalendarConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);

  // Form state
  const [displayName, setDisplayName] = useState("");
  const [feedUrl, setFeedUrl] = useState("");
  const [provider, setProvider] = useState<"google" | "microsoft">("google");
  const [color, setColor] = useState(CALENDAR_COLORS[0]);
  const [accountEmail, setAccountEmail] = useState("");
  const [addError, setAddError] = useState("");
  const [adding, setAdding] = useState(false);

  const fetchConnections = useCallback(async () => {
    const { data } = await supabase
      .from("calendar_connections")
      .select("*")
      .order("created_at", { ascending: true });
    setConnections(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  const handleAdd = async () => {
    if (!displayName.trim() || !feedUrl.trim() || !accountEmail.trim()) {
      setAddError("All fields are required");
      return;
    }

    setAdding(true);
    setAddError("");

    // Get user ID
    const { data: users } = await supabase.auth.admin.listUsers();
    const userId = users?.users?.[0]?.id;
    if (!userId) {
      // Fallback: get from existing settings
      const { data: settings } = await supabase
        .from("user_settings")
        .select("user_id")
        .limit(1)
        .single();
      if (!settings?.user_id) {
        setAddError("Could not determine user ID");
        setAdding(false);
        return;
      }
    }

    const { data: settingsData } = await supabase
      .from("user_settings")
      .select("user_id")
      .limit(1)
      .single();

    const { error } = await supabase.from("calendar_connections").insert({
      user_id: settingsData?.user_id,
      provider,
      account_email: accountEmail.trim(),
      display_name: displayName.trim(),
      feed_url: feedUrl.trim(),
      is_ics_feed: true,
      color,
      is_active: true,
    });

    if (error) {
      setAddError(error.message);
      setAdding(false);
      return;
    }

    setDisplayName("");
    setFeedUrl("");
    setAccountEmail("");
    setProvider("google");
    setColor(CALENDAR_COLORS[connections.length % CALENDAR_COLORS.length]);
    setShowAddForm(false);
    setAdding(false);
    fetchConnections();
  };

  const handleSync = async (connectionId: string) => {
    setSyncing(connectionId);
    try {
      await fetch("/api/integrations/calendar/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId }),
      });
      await fetchConnections();
    } catch {
      // Silent fail — user sees last_synced_at didn't update
    }
    setSyncing(null);
  };

  const handleRemove = async (connectionId: string) => {
    // Delete events first, then connection (cascade should handle but be safe)
    await supabase
      .from("calendar_events")
      .delete()
      .eq("connection_id", connectionId);
    await supabase
      .from("calendar_connections")
      .delete()
      .eq("id", connectionId);
    fetchConnections();
  };

  if (loading) return null;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-balance font-heading flex items-center gap-2">
          <Calendar className="size-4" />
          Calendar Feeds
        </h2>
        <p className="text-xs text-muted-foreground mt-1 text-pretty">
          Connect your calendars via ICS feed URLs. Events sync every 10
          minutes.
        </p>
      </div>

      {/* Connected calendars */}
      {connections.length > 0 && (
        <div className="space-y-2">
          {connections.map((conn) => (
            <div
              key={conn.id}
              className="flex items-center gap-3 rounded-lg border border-border/50 bg-card/50 p-3"
            >
              <div
                className="size-3 rounded-full shrink-0"
                style={{ backgroundColor: conn.color }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {conn.display_name || conn.account_email}
                </p>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="capitalize">{conn.provider}</span>
                  <span className="text-border">|</span>
                  {conn.last_synced_at ? (
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="size-3 text-emerald-400" />
                      Synced{" "}
                      {new Date(conn.last_synced_at).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <XCircle className="size-3 text-muted-foreground" />
                      Not synced yet
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => handleSync(conn.id)}
                disabled={syncing === conn.id}
                className="p-1.5 rounded text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Sync now"
              >
                <RefreshCw
                  className={cn(
                    "size-3.5",
                    syncing === conn.id && "animate-spin"
                  )}
                />
              </button>
              <button
                onClick={() => handleRemove(conn.id)}
                className="p-1.5 rounded text-muted-foreground hover:text-red-400 transition-colors"
                aria-label="Remove calendar"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add form */}
      {showAddForm ? (
        <div className="rounded-lg border border-border/50 bg-card/30 p-4 space-y-4">
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground uppercase">
              Calendar Name
            </Label>
            <Input
              autoFocus
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g., Personal, Sandler, Niewdel"
              className="bg-background/50 border-border/50 rounded-lg"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground uppercase">
              Email Address
            </Label>
            <Input
              value={accountEmail}
              onChange={(e) => setAccountEmail(e.target.value)}
              placeholder="you@example.com"
              className="bg-background/50 border-border/50 rounded-lg"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground uppercase">
              ICS Feed URL
            </Label>
            <Input
              value={feedUrl}
              onChange={(e) => setFeedUrl(e.target.value)}
              placeholder="https://calendar.google.com/calendar/ical/..."
              className="bg-background/50 border-border/50 rounded-lg text-xs"
            />
            <p className="text-[10px] text-muted-foreground text-pretty">
              Google: Calendar Settings → Share → Secret address in iCal format.
              Outlook: Share → Get ICS link.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase">
                Provider
              </Label>
              <Select
                value={provider}
                onValueChange={(v) =>
                  setProvider(v as "google" | "microsoft")
                }
              >
                <SelectTrigger className="bg-background/50 border-border/50 rounded-lg">
                  <SelectValue>
                    {provider === "google" ? "Google" : "Outlook"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="bg-popover border-border rounded-lg">
                  <SelectItem value="google" className="rounded-lg">
                    Google
                  </SelectItem>
                  <SelectItem value="microsoft" className="rounded-lg">
                    Outlook
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase">
                Color
              </Label>
              <div className="flex gap-1.5 flex-wrap pt-1">
                {CALENDAR_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={cn(
                      "size-6 rounded-full transition-all",
                      color === c
                        ? "ring-2 ring-foreground ring-offset-2 ring-offset-background"
                        : "hover:scale-110"
                    )}
                    style={{ backgroundColor: c }}
                    aria-label={`Color ${c}`}
                  />
                ))}
              </div>
            </div>
          </div>

          {addError && (
            <p className="text-xs text-red-400 text-pretty">{addError}</p>
          )}

          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowAddForm(false);
                setAddError("");
              }}
              className="rounded-lg"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={adding}
              className="gap-1.5 bg-foreground hover:bg-foreground/90 text-background border-0 rounded-lg"
            >
              {adding ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add Calendar"
              )}
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setColor(
              CALENDAR_COLORS[connections.length % CALENDAR_COLORS.length]
            );
            setShowAddForm(true);
          }}
          className="gap-1.5 rounded-lg text-xs"
        >
          <Plus className="size-3.5" />
          Add Calendar Feed
        </Button>
      )}
    </div>
  );
}
