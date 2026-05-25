"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Layers,
  MoreHorizontal,
  Play,
  DollarSign,
  Bug,
  Settings,
  CalendarDays,
  Calendar,
  Zap,
  X,
  Users,
  Gauge,
  TrendingUp,
  KanbanSquare,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Workspace } from "@/types/database";

const mainTabs = [
  { name: "Today", href: "/dashboard", icon: LayoutDashboard },
  { name: "This Week", href: "/upcoming", icon: CalendarDays },
  { name: "Pipeline", href: "/pipeline", icon: KanbanSquare },
  { name: "Calendar", href: "/calendar", icon: Calendar },
  { name: "Task Dump", href: "/dump", icon: Zap },
];

const moreItems = [
  // Agents (autonomous — runs on a cron)
  { name: "SEO Agent", href: "/seo", icon: TrendingUp, group: "Agents" },
  // Tools (manual / on-demand)
  { name: "Lead Gen", href: "/leads", icon: Users, group: "Tools" },
  { name: "Website Scoring", href: "/audits", icon: Gauge, group: "Tools" },
  { name: "Expenses", href: "/expenses", icon: DollarSign, group: "Tools" },
  { name: "Video Digests", href: "/videos", icon: Play, group: "Tools" },
  { name: "Bug Reports", href: "/issues", icon: Bug, group: "Tools" },
  { name: "Settings", href: "/settings", icon: Settings, group: "Tools" },
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
          className="fixed inset-0 z-30 bg-foreground/30 md:hidden"
          onClick={() => { setShowWorkspaces(false); setShowMore(false); }}
        />
      )}

      {/* Workspaces sheet */}
      {showWorkspaces && (
        <div className="fixed bottom-16 left-0 right-0 z-30 md:hidden bg-popover border-t border-border rounded-t-2xl p-4 pb-2 safe-area-bottom shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold font-heading">Workspaces</h3>
            <button aria-label="Close" onClick={() => setShowWorkspaces(false)} className="p-2.5 rounded-lg hover:bg-accent">
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
                    isActive ? "bg-[var(--rust-tint)] text-foreground" : "text-muted-foreground hover:bg-accent",
                  )}
                >
                  <span
                    className={cn("size-2.5 rounded-full shrink-0", !ws.color?.startsWith("#") && ws.color)}
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
        <div className="fixed bottom-16 left-0 right-0 z-30 md:hidden bg-popover border-t border-border rounded-t-2xl p-4 pb-2 safe-area-bottom shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold font-heading">More</h3>
            <button aria-label="Close" onClick={() => setShowMore(false)} className="p-2.5 rounded-lg hover:bg-accent">
              <X className="size-4 text-muted-foreground" />
            </button>
          </div>
          <div className="space-y-4">
            {["Agents", "Tools"].map((groupName) => {
              const groupItems = moreItems.filter((i) => i.group === groupName);
              if (groupItems.length === 0) return null;
              return (
                <div key={groupName} className="space-y-1">
                  <p className="mono-tag-muted px-3 pb-1">{groupName}</p>
                  {groupItems.map((item) => {
                    const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors",
                          isActive ? "bg-[var(--rust-tint)] text-foreground" : "text-muted-foreground hover:bg-accent",
                        )}
                      >
                        <item.icon className={cn("size-4", isActive && "text-primary")} />
                        <span>{item.name}</span>
                      </Link>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Bottom tab bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 md:hidden bg-card border-t border-border safe-area-bottom">
        <div className="flex items-center justify-around h-16">
          {mainTabs.map((tab) => {
            const isActive = pathname === tab.href || pathname.startsWith(tab.href + "/");
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 min-w-[64px] h-full transition-colors",
                  isActive ? "text-foreground" : "text-muted-foreground",
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
              isWorkspaceActive || showWorkspaces ? "text-foreground" : "text-muted-foreground",
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
              isMoreActive || showMore ? "text-foreground" : "text-muted-foreground",
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
