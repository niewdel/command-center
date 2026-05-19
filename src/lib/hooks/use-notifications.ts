import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { localDateString } from "@/lib/utils";

type NotificationCheck = {
  overdue: number;
  dueSoon: number;
};

const CHECK_INTERVAL = 15 * 60 * 1000; // 15 minutes
const DUE_SOON_HOURS = 2;

export function useNotifications(enabled: boolean) {
  const lastCheckRef = useRef<string | null>(null);

  const checkAndNotify = useCallback(async () => {
    if (!enabled || Notification.permission !== "granted") return;

    const now = new Date();
    const todayStr = localDateString(now);
    const checkKey = `${todayStr}-${now.getHours()}`;

    // Don't spam — only check once per hour-block
    if (lastCheckRef.current === checkKey) return;
    lastCheckRef.current = checkKey;

    // Check overdue tasks
    const { data: overdueTasks } = await supabase
      .from("tasks")
      .select("id, title, due_date")
      .lt("due_date", todayStr)
      .neq("status", "done")
      .limit(10);

    if (overdueTasks && overdueTasks.length > 0) {
      const count = overdueTasks.length;
      new Notification("Overdue Tasks", {
        body:
          count === 1
            ? `"${overdueTasks[0].title}" is overdue`
            : `You have ${count} overdue tasks`,
        icon: "/icons/icon-192.png",
        tag: "overdue",
      });
    }

    // Check tasks due today that are not yet done
    const { data: dueTodayTasks } = await supabase
      .from("tasks")
      .select("id, title, due_date")
      .eq("due_date", todayStr)
      .neq("status", "done")
      .limit(10);

    if (dueTodayTasks && dueTodayTasks.length > 0 && now.getHours() >= 14) {
      // Only alert about same-day deadlines in the afternoon
      new Notification("Due Today", {
        body:
          dueTodayTasks.length === 1
            ? `"${dueTodayTasks[0].title}" is due today`
            : `${dueTodayTasks.length} tasks due today`,
        icon: "/icons/icon-192.png",
        tag: "due-today",
      });
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled || typeof Notification === "undefined") return;

    // Initial check after a short delay
    const initialTimeout = setTimeout(checkAndNotify, 5000);

    // Periodic check
    const interval = setInterval(checkAndNotify, CHECK_INTERVAL);

    // Also check when app comes to foreground
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        checkAndNotify();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [enabled, checkAndNotify]);
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof Notification === "undefined") return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;

  const result = await Notification.requestPermission();
  return result === "granted";
}

export function getNotificationStatus(): "granted" | "denied" | "default" | "unsupported" {
  if (typeof Notification === "undefined") return "unsupported";
  return Notification.permission;
}
