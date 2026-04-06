"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Layers,
  MoreHorizontal,
  Newspaper,
  Play,
  DollarSign,
  Bug,
  Target,
  Settings,
  CalendarDays,
  Calendar,
  Zap,
  X,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Workspace } from "@/types/database";

const mainTabs = [
  { name: "Today", href: "/dashboard", icon: LayoutDashboard },
  { name: "This Week", href: "/upcoming", icon: CalendarDays },
  { name: "Calendar", href: "/calendar", icon: Calendar },
  { name: "Task Dump", href: "/dump", icon: Zap },
];

const moreItems = [
  { name: "Goals", href: "/goals", icon: Target },
  { name: "Expenses", href: "/expenses", icon: DollarSign },
  { name: "Videos", href: "/videos", icon: Play },
  { name: "News", href: "/news", icon: Newspaper },
  { name: "Issues", href: "/issues", icon: Bug },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function BottomNav() {
  const pathname = usePathname();
  const [showWorkspaces, setShowWorkspaces] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);

  const fetchWorkspaces = useCallback(async () => {
    const { data } = await supabase
      .from("workspaces")
      .select("*")
      .order("position", { ascending: true });
    setWorkspaces(data || []);
  }, []);

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  // Close sheets when navigating
  useEffect(() => {
    setShowWorkspaces(false);
    setShowMore(false);
  }, [pathname]);

  const isWorkspaceActive = pathname.startsWith("/workspace/");
  const isMoreActive = moreItems.some((item) => pathname === item.href || pathname.startsWith(item.href + "/"));

  return (
    <>
      {/* Bottom sheet overlays */}
      {(showWorkspaces || showMore) && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => { setShowWorkspaces(false); setShowMore(false); }}
        />
      )}

      {/* Workspaces sheet */}
      {showWorkspaces && (
        <div className="fixed bottom-16 left-0 right-0 z-30 md:hidden bg-card border-t border-border rounded-t-2xl p-4 pb-2 safe-area-bottom">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold font-heading">Workspaces</h3>
            <button aria-label="Close" onClick={() => setShowWorkspaces(false)} className="p-1 rounded-lg hover:bg-accent">
              <X className="size-4 text-muted-foreground" />
            </button>
          </div>
          <div className="space-y-1">
            {workspaces.map((ws) => {
              const isActive = pathname === `/workspace/${ws.slug}` || pathname.startsWith(`/workspace/${ws.slug}/`);
              return (
                <Link
                  key={ws.id}
                  href={`/workspace/${ws.slug}`}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors",
                    isActive ? "bg-accent text-foreground" : "text-muted-foreground"
                  )}
                >
                  <span
                    className={cn("size-3 rounded-full shrink-0", !ws.color?.startsWith("#") && ws.color)}
                    style={ws.color?.startsWith("#") ? { backgroundColor: ws.color } : undefined}
                  />
                  <span>{ws.name}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* More sheet */}
      {showMore && (
        <div className="fixed bottom-16 left-0 right-0 z-30 md:hidden bg-card border-t border-border rounded-t-2xl p-4 pb-2 safe-area-bottom">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold font-heading">More</h3>
            <button aria-label="Close" onClick={() => setShowMore(false)} className="p-1 rounded-lg hover:bg-accent">
              <X className="size-4 text-muted-foreground" />
            </button>
          </div>
          <div className="space-y-1">
            {moreItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors",
                    isActive ? "bg-accent text-foreground" : "text-muted-foreground"
                  )}
                >
                  <item.icon className="size-4" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Bottom tab bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 md:hidden bg-card/95 border-t border-border backdrop-blur-sm safe-area-bottom">
        <div className="flex items-center justify-around h-16">
          {mainTabs.map((tab) => {
            const isActive = pathname === tab.href || pathname.startsWith(tab.href + "/");
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 min-w-[64px] h-full transition-colors",
                  isActive ? "text-foreground" : "text-muted-foreground"
                )}
              >
                <tab.icon className={cn("size-5", isActive && "text-primary")} />
                <span className="text-[10px] font-medium">{tab.name}</span>
              </Link>
            );
          })}

          {/* Workspaces tab */}
          <button
            onClick={() => { setShowMore(false); setShowWorkspaces(!showWorkspaces); }}
            className={cn(
              "flex flex-col items-center justify-center gap-1 min-w-[64px] h-full transition-colors",
              isWorkspaceActive || showWorkspaces ? "text-foreground" : "text-muted-foreground"
            )}
          >
            <Layers className={cn("size-5", (isWorkspaceActive || showWorkspaces) && "text-primary")} />
            <span className="text-[10px] font-medium">Spaces</span>
          </button>

          {/* More tab */}
          <button
            onClick={() => { setShowWorkspaces(false); setShowMore(!showMore); }}
            className={cn(
              "flex flex-col items-center justify-center gap-1 min-w-[64px] h-full transition-colors",
              isMoreActive || showMore ? "text-foreground" : "text-muted-foreground"
            )}
          >
            <MoreHorizontal className={cn("size-5", (isMoreActive || showMore) && "text-primary")} />
            <span className="text-[10px] font-medium">More</span>
          </button>
        </div>
      </nav>
    </>
  );
}
