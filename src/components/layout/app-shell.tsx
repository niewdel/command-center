"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { BottomNav } from "@/components/layout/bottom-nav";
import { CommandPalette } from "@/components/search/command-palette";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ToastProvider } from "@/components/ui/toast";
import { useNotifications, getNotificationStatus } from "@/lib/hooks/use-notifications";

const AUTH_PAGES = ["/login", "/signup"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = AUTH_PAGES.includes(pathname);

  useNotifications(!isAuthPage && getNotificationStatus() === "granted");

  if (isAuthPage) {
    return <main className="min-h-dvh">{children}</main>;
  }

  return (
    <ToastProvider>
      <TooltipProvider>
        <Sidebar />
        <main className="md:ml-[280px] min-h-dvh pb-20 md:pb-0">{children}</main>
        <BottomNav />
        <CommandPalette />
      </TooltipProvider>
    </ToastProvider>
  );
}
