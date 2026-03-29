"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { UserSettings } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings, Save, Check, Bell, BellOff } from "lucide-react";
import {
  requestNotificationPermission,
  getNotificationStatus,
} from "@/lib/hooks/use-notifications";

export default function SettingsPage() {
  const [settings, setSettings] = useState<Partial<UserSettings>>({
    available_hours_weekday: 8,
    available_hours_weekend: 4,
    shutdown_time: "17:00",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notifStatus, setNotifStatus] = useState<string>("default");

  const fetchSettings = useCallback(async () => {
    const { data } = await supabase
      .from("user_settings")
      .select("*")
      .limit(1)
      .single();
    if (data) setSettings(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSettings();
    setNotifStatus(getNotificationStatus());
  }, [fetchSettings]);

  const handleSave = async () => {
    setSaving(true);
    const { data: user } = await supabase.auth.getUser();
    if (!user?.user) return;

    await supabase.from("user_settings").upsert(
      {
        user_id: user.user.id,
        available_hours_weekday: settings.available_hours_weekday,
        available_hours_weekend: settings.available_hours_weekend,
        shutdown_time: settings.shutdown_time,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-dvh">
        <div className="flex items-center gap-3 text-muted-foreground">
          <div className="size-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <span className="text-sm">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-8">
      <div className="pt-10 md:pt-2 space-y-1">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-lg bg-foreground flex items-center justify-center shadow-sm">
            <Settings className="size-5 text-background" />
          </div>
          <h1 className="text-2xl font-bold text-balance">Settings</h1>
        </div>
      </div>

      {/* Capacity */}
      <div className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-balance">Daily Capacity</h2>
          <p className="text-xs text-muted-foreground mt-1 text-pretty">
            How many productive hours do you have per day? Used to calculate your capacity bar and overcommitment warnings.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground uppercase">
              Weekday Hours
            </Label>
            <Input
              type="number"
              min={1}
              max={16}
              step={0.5}
              value={settings.available_hours_weekday ?? 8}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  available_hours_weekday: parseFloat(e.target.value) || 8,
                }))
              }
              className="bg-background/50 border-border/50 rounded-lg"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground uppercase">
              Weekend Hours
            </Label>
            <Input
              type="number"
              min={0}
              max={16}
              step={0.5}
              value={settings.available_hours_weekend ?? 4}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  available_hours_weekend: parseFloat(e.target.value) || 4,
                }))
              }
              className="bg-background/50 border-border/50 rounded-lg"
            />
          </div>
        </div>
      </div>

      {/* Shutdown */}
      <div className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-balance">Shutdown Time</h2>
          <p className="text-xs text-muted-foreground mt-1 text-pretty">
            When does your workday end? Triggers the evening shutdown ritual reminder.
          </p>
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-medium text-muted-foreground uppercase">
            End of Day
          </Label>
          <Input
            type="time"
            value={settings.shutdown_time ?? "17:00"}
            onChange={(e) =>
              setSettings((s) => ({ ...s, shutdown_time: e.target.value }))
            }
            className="w-[180px] bg-background/50 border-border/50 rounded-lg"
          />
        </div>
      </div>

      {/* Notifications */}
      <div className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-balance">Notifications</h2>
          <p className="text-xs text-muted-foreground mt-1 text-pretty">
            Get reminders for overdue tasks and upcoming deadlines.
          </p>
        </div>
        <div className="flex items-center gap-4 rounded-lg border border-border/50 bg-card/50 p-4">
          <div className="size-10 rounded-lg bg-foreground flex items-center justify-center shadow-sm">
            {notifStatus === "granted" ? (
              <Bell className="size-5 text-background" />
            ) : (
              <BellOff className="size-5 text-background" />
            )}
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-pretty">Task Reminders</p>
            <p className="text-xs text-muted-foreground text-pretty">
              {notifStatus === "granted"
                ? "Notifications enabled — you'll get alerts for overdue and due-today tasks"
                : notifStatus === "denied"
                ? "Notifications blocked — enable in browser settings"
                : notifStatus === "unsupported"
                ? "Notifications not supported in this browser"
                : "Enable notifications to get task reminders"}
            </p>
          </div>
          {notifStatus === "default" && (
            <Button
              variant="outline"
              size="sm"
              className="rounded-lg text-xs"
              onClick={async () => {
                const granted = await requestNotificationPermission();
                setNotifStatus(granted ? "granted" : "denied");
              }}
            >
              Enable
            </Button>
          )}
          {notifStatus === "granted" && (
            <span className="text-xs text-emerald-400 font-medium">Active</span>
          )}
        </div>
      </div>

      {/* Calendar integrations placeholder */}
      <div className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-balance">Calendar Integrations</h2>
          <p className="text-xs text-muted-foreground mt-1 text-pretty">
            Connect your calendars to see all your meetings in one place.
          </p>
        </div>
        <div className="space-y-3">
          {[
            { name: "Google Calendar", icon: "G", color: "bg-muted", status: "coming soon" },
            { name: "Outlook / Microsoft 365", icon: "M", color: "bg-muted", status: "coming soon" },
            { name: "Apple Calendar", icon: "A", color: "bg-muted", status: "coming soon" },
          ].map((cal) => (
            <div
              key={cal.name}
              className="flex items-center gap-4 rounded-lg border border-border/50 bg-card/50 p-4"
            >
              <div
                className={`size-10 rounded-lg ${cal.color} flex items-center justify-center shadow-sm`}
              >
                <span className="font-bold text-sm">{cal.icon}</span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-pretty">{cal.name}</p>
                <p className="text-xs text-muted-foreground capitalize text-pretty">{cal.status}</p>
              </div>
              <Button variant="outline" size="sm" disabled className="rounded-lg text-xs">
                Connect
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Save */}
      <div className="pt-4">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="gap-2 bg-foreground hover:bg-foreground/90 text-background border-0 rounded-lg shadow-sm"
        >
          {saved ? (
            <>
              <Check className="size-4" />
              Saved
            </>
          ) : saving ? (
            "Saving..."
          ) : (
            <>
              <Save className="size-4" />
              Save Settings
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
