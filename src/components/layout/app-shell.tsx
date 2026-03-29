"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { CommandPalette } from "@/components/search/command-palette";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ToastProvider } from "@/components/ui/toast";
import { useNotifications, getNotificationStatus } from "@/lib/hooks/use-notifications";

const AUTH_PAGES = ["/login", "/signup"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = AUTH_PAGES.includes(pathname);

  // Run notifications globally (only when permission is granted)
  useNotifications(!isAuthPage && getNotificationStatus() === "granted");

  if (isAuthPage) {
    return <main className="min-h-screen">{children}</main>;
  }

  return (
    <ToastProvider>
      <TooltipProvider>
        <Sidebar />
        <main className="md:ml-[280px] min-h-screen">{children}</main>
        <CommandPalette />
      </TooltipProvider>
    </ToastProvider>
  );
}
