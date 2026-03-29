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
    gradient: "from-indigo-500 to-purple-600",
    glow: "shadow-indigo-500/20",
  },
  {
    name: "Niewdel",
    slug: "niewdel",
    href: "/workspace/niewdel",
    logo: "/logos/niewdel-icon.png",
    gradient: "from-violet-500 to-purple-600",
    glow: "shadow-violet-500/20",
  },
  {
    name: "i10 Solutions",
    slug: "i10",
    href: "/workspace/i10",
    logo: "/logos/i10-logo.png",
    gradient: "from-emerald-500 to-teal-600",
    glow: "shadow-emerald-500/20",
  },
  {
    name: "Personal",
    slug: "personal",
    href: "/workspace/personal",
    icon: User,
    gradient: "from-amber-500 to-orange-600",
    glow: "shadow-amber-500/20",
  },
];

const extraNav = [
  {
    name: "Upcoming",
    href: "/upcoming",
    icon: CalendarDays,
    gradient: "from-cyan-500 to-blue-600",
    glow: "shadow-cyan-500/20",
  },
  {
    name: "Calendar",
    href: "/calendar",
    icon: Calendar,
    gradient: "from-blue-500 to-indigo-600",
    glow: "shadow-blue-500/20",
  },
  {
    name: "Goals",
    href: "/goals",
    icon: Target,
    gradient: "from-rose-500 to-pink-600",
    glow: "shadow-rose-500/20",
  },
  {
    name: "Notes",
    href: "/notes",
    icon: FileText,
    gradient: "from-amber-500 to-orange-600",
    glow: "shadow-amber-500/20",
  },
  {
    name: "Digests",
    href: "/digests",
    icon: BookOpen,
    gradient: "from-red-500 to-pink-600",
    glow: "shadow-red-500/20",
  },
  {
    name: "Settings",
    href: "/settings",
    icon: Settings,
    gradient: "from-slate-500 to-slate-700",
    glow: "shadow-slate-500/20",
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
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-50 md:hidden rounded-xl bg-card/80 backdrop-blur-sm border border-border/50 p-2.5 shadow-lg"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-[280px] flex flex-col transition-transform duration-300 ease-out",
          "bg-sidebar border-r border-sidebar-border",
          "md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
              <span className="text-white font-bold text-sm">CC</span>
            </div>
            <div>
              <h1 className="text-sm font-semibold tracking-tight text-foreground">Command Center</h1>
              <p className="text-[11px] text-muted-foreground">by Niewdel</p>
            </div>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="md:hidden rounded-lg p-1.5 hover:bg-accent transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <p className="px-3 mb-2 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
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
                  "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-accent text-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                )}
              >
                <div
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all duration-200",
                    isActive
                      ? `bg-gradient-to-br ${ws.gradient} shadow-lg ${ws.glow}`
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
                        "h-4 w-4",
                        isActive ? "text-white" : "text-muted-foreground group-hover:text-foreground"
                      )}
                    />
                  ) : null}
                </div>
                <span className="flex-1">{ws.name}</span>
                {isActive && (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
              </Link>
            );
          })}

          <div className="pt-4">
            <p className="px-3 mb-2 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
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
                    "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                    isActive
                      ? "bg-accent text-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                  )}
                >
                  <div
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all duration-200",
                      isActive
                        ? `bg-gradient-to-br ${item.gradient} shadow-lg ${item.glow}`
                        : "bg-muted group-hover:bg-accent"
                    )}
                  >
                    <item.icon
                      className={cn(
                        "h-4 w-4",
                        isActive ? "text-white" : "text-muted-foreground group-hover:text-foreground"
                      )}
                    />
                  </div>
                  <span className="flex-1">{item.name}</span>
                  {isActive && (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
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
            className="w-full gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-lg shadow-indigo-500/25 border-0 rounded-xl h-10 font-medium transition-all duration-200 hover:shadow-indigo-500/40"
            size="sm"
          >
            <Plus className="h-4 w-4" />
            Quick Add
            <kbd className="ml-auto text-[10px] opacity-60 bg-white/10 px-1.5 py-0.5 rounded">
              {typeof navigator !== "undefined" && /Mac/.test(navigator.userAgent) ? "⌘" : "Ctrl+"}N
            </kbd>
          </Button>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all duration-200"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Quick Add Dialog */}
      <QuickAddDialog open={quickAddOpen} onClose={() => setQuickAddOpen(false)} />
    </>
  );
}
