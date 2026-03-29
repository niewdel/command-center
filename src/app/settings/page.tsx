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
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex items-center gap-3 text-muted-foreground">
          <div className="h-5 w-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <span className="text-sm">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-8">
      <div className="pt-10 md:pt-2 space-y-1">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-slate-500 to-slate-700 flex items-center justify-center shadow-lg">
            <Settings className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        </div>
      </div>

      {/* Capacity */}
      <div className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold">Daily Capacity</h2>
          <p className="text-xs text-muted-foreground mt-1">
            How many productive hours do you have per day? Used to calculate your capacity bar and overcommitment warnings.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
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
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
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
          <h2 className="text-sm font-semibold">Shutdown Time</h2>
          <p className="text-xs text-muted-foreground mt-1">
            When does your workday end? Triggers the evening shutdown ritual reminder.
          </p>
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
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
          <h2 className="text-sm font-semibold">Notifications</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Get reminders for overdue tasks and upcoming deadlines.
          </p>
        </div>
        <div className="flex items-center gap-4 rounded-xl border border-border/50 bg-card/50 p-4">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
            {notifStatus === "granted" ? (
              <Bell className="h-5 w-5 text-white" />
            ) : (
              <BellOff className="h-5 w-5 text-white" />
            )}
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">Task Reminders</p>
            <p className="text-xs text-muted-foreground">
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
          <h2 className="text-sm font-semibold">Calendar Integrations</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Connect your calendars to see all your meetings in one place.
          </p>
        </div>
        <div className="space-y-3">
          {[
            { name: "Google Calendar", icon: "G", color: "from-blue-500 to-blue-600", status: "coming soon" },
            { name: "Outlook / Microsoft 365", icon: "M", color: "from-sky-500 to-blue-700", status: "coming soon" },
            { name: "Apple Calendar", icon: "A", color: "from-gray-600 to-gray-800", status: "coming soon" },
          ].map((cal) => (
            <div
              key={cal.name}
              className="flex items-center gap-4 rounded-xl border border-border/50 bg-card/50 p-4"
            >
              <div
                className={`h-10 w-10 rounded-lg bg-gradient-to-br ${cal.color} flex items-center justify-center shadow-lg`}
              >
                <span className="text-white font-bold text-sm">{cal.icon}</span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">{cal.name}</p>
                <p className="text-xs text-muted-foreground capitalize">{cal.status}</p>
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
          className="gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white border-0 rounded-xl shadow-lg shadow-indigo-500/25"
        >
          {saved ? (
            <>
              <Check className="h-4 w-4" />
              Saved
            </>
          ) : saving ? (
            "Saving..."
          ) : (
            <>
              <Save className="h-4 w-4" />
              Save Settings
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
