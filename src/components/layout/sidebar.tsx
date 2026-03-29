"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  User,
  Plus,
  Menu,
  X,
  ChevronRight,
  LogOut,
  Target,
  CalendarDays,
  Calendar,
  Settings,
  FileText,
  BookOpen,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { QuickAddDialog } from "@/components/layout/quick-add-dialog";

const workspaces = [
  {
    name: "Today",
    slug: "dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    color: "bg-indigo-500",
  },
  {
    name: "Niewdel",
    slug: "niewdel",
    href: "/workspace/niewdel",
    logo: "/logos/niewdel-icon.png",
    color: "bg-violet-500",
  },
  {
    name: "i10 Solutions",
    slug: "i10",
    href: "/workspace/i10",
    logo: "/logos/i10-logo.png",
    color: "bg-emerald-500",
  },
  {
    name: "Personal",
    slug: "personal",
    href: "/workspace/personal",
    icon: User,
    color: "bg-amber-500",
  },
];

const extraNav = [
  {
    name: "Upcoming",
    href: "/upcoming",
    icon: CalendarDays,
    color: "bg-cyan-500",
  },
  {
    name: "Calendar",
    href: "/calendar",
    icon: Calendar,
    color: "bg-blue-500",
  },
  {
    name: "Goals",
    href: "/goals",
    icon: Target,
    color: "bg-rose-500",
  },
  {
    name: "Notes",
    href: "/notes",
    icon: FileText,
    color: "bg-amber-500",
  },
  {
    name: "Digests",
    href: "/digests",
    icon: BookOpen,
    color: "bg-red-500",
  },
  {
    name: "Settings",
    href: "/settings",
    icon: Settings,
    color: "bg-slate-500",
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);

  // Global keyboard shortcut: Cmd+N or Ctrl+N for Quick Add
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "n") {
      e.preventDefault();
      setQuickAddOpen(true);
    }
  }, []);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <>
      {/* Mobile menu button */}
      <button
        aria-label="Open menu"
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-40 md:hidden rounded-lg bg-card border border-border p-2.5 shadow-sm"
      >
        <Menu className="size-5" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-[280px] flex flex-col transition-transform duration-200 ease-out",
          "bg-sidebar border-r border-sidebar-border",
          "md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-lg bg-foreground flex items-center justify-center">
              <span className="text-background font-bold text-sm">CC</span>
            </div>
            <div>
              <h1 className="text-sm font-semibold text-foreground text-balance">Command Center</h1>
              <p className="text-[11px] text-muted-foreground text-pretty">by Niewdel</p>
            </div>
          </div>
          <button
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
            className="md:hidden rounded-lg p-1.5 hover:bg-accent transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <p className="px-3 mb-2 text-[11px] font-medium uppercase text-muted-foreground">
            Workspaces
          </p>
          {workspaces.map((ws) => {
            const isActive =
              pathname === ws.href || pathname.startsWith(ws.href + "/");
            return (
              <Link
                key={ws.slug}
                href={ws.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                )}
              >
                <div
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors",
                    isActive
                      ? ws.color
                      : "bg-muted group-hover:bg-accent"
                  )}
                >
                  {ws.logo ? (
                    <Image
                      src={ws.logo}
                      alt={ws.name}
                      width={20}
                      height={20}
                      className="object-contain"
                    />
                  ) : ws.icon ? (
                    <ws.icon
                      className={cn(
                        "size-4",
                        isActive ? "text-white" : "text-muted-foreground group-hover:text-foreground"
                      )}
                    />
                  ) : null}
                </div>
                <span className="flex-1">{ws.name}</span>
                {isActive && (
                  <ChevronRight className="size-4 text-muted-foreground" />
                )}
              </Link>
            );
          })}

          <div className="pt-4">
            <p className="px-3 mb-2 text-[11px] font-medium uppercase text-muted-foreground">
              Planning
            </p>
            {extraNav.map((item) => {
              const isActive =
                pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                  )}
                >
                  <div
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors",
                      isActive
                        ? item.color
                        : "bg-muted group-hover:bg-accent"
                    )}
                  >
                    <item.icon
                      className={cn(
                        "size-4",
                        isActive ? "text-white" : "text-muted-foreground group-hover:text-foreground"
                      )}
                    />
                  </div>
                  <span className="flex-1">{item.name}</span>
                  {isActive && (
                    <ChevronRight className="size-4 text-muted-foreground" />
                  )}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Bottom actions */}
        <div className="p-4 border-t border-sidebar-border space-y-2">
          <Button
            onClick={() => setQuickAddOpen(true)}
            className="w-full gap-2 bg-foreground text-background hover:bg-foreground/90 border-0 rounded-lg h-10 font-medium"
            size="sm"
          >
            <Plus className="size-4" />
            Quick Add
            <kbd className="ml-auto text-[10px] opacity-60 bg-background/10 px-1.5 py-0.5 rounded">
              {typeof navigator !== "undefined" && /Mac/.test(navigator.userAgent) ? "⌘" : "Ctrl+"}N
            </kbd>
          </Button>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
          >
            <LogOut className="size-3.5" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Quick Add Dialog */}
      <QuickAddDialog open={quickAddOpen} onClose={() => setQuickAddOpen(false)} />
    </>
  );
}
