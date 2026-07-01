"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { UserSettings } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageLayout } from "@/components/layout/page-layout";
import { Settings, Save, Check, Bell, BellOff, BookOpen, Compass } from "lucide-react";
import {
  requestNotificationPermission,
  getNotificationStatus,
} from "@/lib/hooks/use-notifications";
import { CalendarConnections } from "@/components/settings/calendar-connections";
import { RoutineEditor } from "@/components/settings/routine-editor";
import { requestTourReplay } from "@/lib/onboarding/replay-signal";

export default function SettingsPage() {
  const router = useRouter();
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

    await supabase.from("user_settings").upsert(
      {
        user_id: settings.user_id,
        available_hours_weekday: settings.available_hours_weekday,
        available_hours_weekend: settings.available_hours_weekend,
        shutdown_time: settings.shutdown_time,
        digest_context: settings.digest_context || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <PageLayout
      title="Settings"
      eyebrow="Configuration"
      icon={Settings}
      loading={loading}
      maxWidth="sm"
    >
      {/* Capacity */}
      <div className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-balance font-heading">Daily Capacity</h2>
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
                  available_hours_weekday: e.target.value === "" ? 0 : parseFloat(e.target.value),
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
                  available_hours_weekend: e.target.value === "" ? 0 : parseFloat(e.target.value),
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
          <h2 className="text-sm font-semibold text-balance font-heading">Shutdown Time</h2>
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
          <h2 className="text-sm font-semibold text-balance font-heading">Notifications</h2>
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
                ? "Notifications enabled. You'll get alerts for overdue and due-today tasks."
                : notifStatus === "denied"
                ? "Notifications blocked. Enable in browser settings."
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

      {/* Product tour */}
      <div className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-balance font-heading">Product Tour</h2>
          <p className="text-xs text-muted-foreground mt-1 text-pretty">
            Walk through the CRM pipeline again, board, quick-add, deal timeline, next actions, My Day, and the forecast dashboard.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 rounded-lg text-xs"
          onClick={() => {
            requestTourReplay();
            router.push("/pipeline");
          }}
        >
          <Compass className="size-4" />
          Replay walkthrough
        </Button>
      </div>

      {/* Daily Routines */}
      <RoutineEditor />

      {/* Calendar Connections */}
      <CalendarConnections />

      {/* Digest Profile */}
      <div className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-balance font-heading flex items-center gap-2">
            <BookOpen className="size-4" />
            Digest Profile
          </h2>
          <p className="text-xs text-muted-foreground mt-1 text-pretty">
            Tell the AI what you're working on so every video digest is personalized to your projects, tech stack, and priorities. The more specific, the better the action items.
          </p>
        </div>
        <textarea
          value={settings.digest_context ?? ""}
          onChange={(e) =>
            setSettings((s) => ({ ...s, digest_context: e.target.value }))
          }
          rows={8}
          placeholder={`Example:\n- Building a Next.js + Supabase command center with integrations to HubSpot, Slack, Gmail\n- Using Claude Code daily with custom MCP servers and hooks\n- Interested in: AI agents, workflow automation, voice AI, content pipelines\n- Current focus: Getting Slack integration and content digester working\n- Tech I use: TypeScript, React 19, Tailwind CSS 4, Railway, Vercel`}
          className="w-full rounded-lg border border-border/50 bg-background/50 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring resize-y min-h-[120px]"
        />
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
    </PageLayout>
  );
}
