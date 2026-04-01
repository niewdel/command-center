"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { UserSettings, EmailConnection } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageLayout } from "@/components/layout/page-layout";
import { Settings, Save, Check, Bell, BellOff, Mail, RefreshCw, Trash2, Loader2, BookOpen } from "lucide-react";
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
  const [emailConnections, setEmailConnections] = useState<EmailConnection[]>([]);
  const [syncing, setSyncing] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    const [{ data }, { data: connections }] = await Promise.all([
      supabase.from("user_settings").select("*").limit(1).single(),
      supabase.from("email_connections").select("*").order("created_at"),
    ]);
    if (data) setSettings(data);
    setEmailConnections(connections || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSettings();
    setNotifStatus(getNotificationStatus());
  }, [fetchSettings]);

  const handleDisconnect = async (connectionId: string) => {
    await supabase.from("email_connections").delete().eq("id", connectionId);
    fetchSettings();
  };

  const handleSyncNow = async (connectionId: string) => {
    setSyncing(connectionId);
    try {
      await fetch("/api/integrations/sync-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_DIGEST_PROCESS_SECRET || ""}`,
        },
        body: JSON.stringify({ connectionId }),
      });
      fetchSettings();
    } catch { /* ignore */ }
    setSyncing(null);
  };

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
    <PageLayout title="Settings" icon={Settings} loading={loading} maxWidth="sm">
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

      {/* Calendar integrations */}
      <div className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-balance font-heading">Calendar Integrations</h2>
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

      {/* Email integrations */}
      <div className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-balance font-heading">Email Integrations</h2>
          <p className="text-xs text-muted-foreground mt-1 text-pretty">
            Connect your email accounts to see all messages in one inbox.
          </p>
        </div>

        {/* Connected accounts */}
        {emailConnections.length > 0 && (
          <div className="space-y-2">
            {emailConnections.map((conn) => (
              <div
                key={conn.id}
                className="flex items-center gap-4 rounded-lg border border-border/50 bg-card/50 p-4"
              >
                <div className="size-10 rounded-lg bg-muted flex items-center justify-center">
                  <Mail className="size-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate text-pretty">{conn.account_email}</p>
                  <p className="text-xs text-muted-foreground text-pretty">
                    {conn.provider === "google" ? "Gmail" : "Outlook"}
                    {conn.last_synced_at && (
                      <> &middot; Last synced {new Date(conn.last_synced_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</>
                    )}
                    {!conn.is_active && <span className="text-red-400 ml-1">Disconnected — reconnect below</span>}
                  </p>
                </div>
                <div className="flex gap-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSyncNow(conn.id)}
                    disabled={syncing === conn.id}
                    className="rounded-lg text-xs gap-1"
                  >
                    {syncing === conn.id ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
                    Sync
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDisconnect(conn.id)}
                    className="rounded-lg text-xs text-muted-foreground hover:text-red-400"
                  >
                    <Trash2 className="size-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Connect new accounts */}
        <div className="space-y-2">
          {[
            { name: "Gmail", provider: "google", letter: "G" },
            { name: "Outlook", provider: "microsoft", letter: "M" },
          ].map((svc) => {
            const isConnected = emailConnections.some((c) => c.provider === svc.provider && c.is_active);
            return (
              <div
                key={svc.provider}
                className="flex items-center gap-4 rounded-lg border border-border/50 bg-card/50 p-4"
              >
                <div className="size-10 rounded-lg bg-muted flex items-center justify-center">
                  <span className="text-sm font-semibold text-muted-foreground">{svc.letter}</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-pretty">Connect {svc.name}</p>
                  <p className="text-xs text-muted-foreground text-pretty">
                    {isConnected ? "Add another account" : "Read-only access to your inbox"}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-lg text-xs"
                  onClick={() => window.location.href = `/api/integrations/${svc.provider}/authorize`}
                >
                  Connect
                </Button>
              </div>
            );
          })}
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
    </PageLayout>
  );
}
