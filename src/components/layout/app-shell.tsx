"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { BottomNav } from "@/components/layout/bottom-nav";
import { Background } from "@/components/layout/background";
import { CommandPalette } from "@/components/search/command-palette";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ToastProvider } from "@/components/ui/toast";
import { useNotifications, getNotificationStatus } from "@/lib/hooks/use-notifications";
import { WorkspacesProvider } from "@/lib/providers/workspaces-provider";
import { RealtimeProvider } from "@/lib/providers/realtime-provider";

// Auth surfaces render with NO operator chrome — no sidebar, providers, or
// command palette. Matches /login and every sub-route (/login/reset,
// /login/update) plus /signup. The recovery pages especially must render
// standalone so the app shell can't interfere with the recovery session.
function isAuthPath(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname === "/signup"
  );
}

export function AppShell({
  children,
  bareShell = false,
}: {
  children: React.ReactNode;
  // Token-protected, client-facing renders of the SEO report (magic link or
  // Playwright print) set this via middleware → root layout. Strips ALL
  // operator chrome — sidebar, bottom nav, command palette, recent items —
  // so the recipient sees only the scoped report.
  bareShell?: boolean;
}) {
  const pathname = usePathname();
  const isAuthPage = isAuthPath(pathname);

  useNotifications(
    !isAuthPage && !bareShell && getNotificationStatus() === "granted"
  );

  if (isAuthPage) {
    return (
      <main className="min-h-dvh safe-area-top safe-area-bottom">
        <Background />
        <div className="relative z-10">{children}</div>
      </main>
    );
  }

  if (bareShell) {
    return <main className="min-h-dvh">{children}</main>;
  }

  return (
    <ToastProvider>
      <TooltipProvider>
        <RealtimeProvider>
          <WorkspacesProvider>
            <Background />
            <Sidebar />
            <main className="relative z-10 md:ml-[var(--sidebar-width)] min-h-dvh pb-20 md:pb-0 safe-area-top pwa-top-pad">{children}</main>
            <BottomNav />
            <CommandPalette />
          </WorkspacesProvider>
        </RealtimeProvider>
      </TooltipProvider>
    </ToastProvider>
  );
}
