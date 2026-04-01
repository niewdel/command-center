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
        {/* Background atmosphere */}
        <div className="fixed inset-0 pointer-events-none" aria-hidden="true">
          {/* Noise grain texture */}
          <div
            className="absolute inset-0 opacity-[0.035]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
              backgroundRepeat: "repeat",
              backgroundSize: "256px 256px",
            }}
          />
          {/* Ambient accent glow */}
          <div
            className="absolute -top-[20%] left-1/2 -translate-x-1/2 w-[140%] h-[60%]"
            style={{
              background: "radial-gradient(ellipse at center, oklch(0.25 0.12 265 / 0.08) 0%, oklch(0.15 0.06 265 / 0.03) 40%, transparent 70%)",
            }}
          />
        </div>

        <Sidebar />
        <main className="relative z-10 md:ml-[var(--sidebar-width)] min-h-dvh pb-20 md:pb-0">{children}</main>
        <BottomNav />
        <CommandPalette />
      </TooltipProvider>
    </ToastProvider>
  );
}
