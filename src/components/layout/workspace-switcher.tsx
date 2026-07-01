"use client";

import { useMemo } from "react";
import { ChevronsUpDown, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useWorkspaces } from "@/lib/providers/workspaces-provider";

function readActiveCookie(): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(/(?:^|;\s*)active_workspace=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export function WorkspaceSwitcher() {
  const { workspaces } = useWorkspaces();
  const activeId = readActiveCookie();
  const active = useMemo(
    () =>
      workspaces.find((w) => w.id === activeId) ??
      workspaces.find((w) => w.slug === "niewdel") ??
      workspaces[0],
    [workspaces, activeId]
  );

  if (workspaces.length < 2 || !active) return null;

  async function switchTo(id: string) {
    if (id === active?.id) return;
    await fetch("/api/tenancy/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId: id }),
    });
    window.location.reload();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Switch workspace"
        className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-sidebar-accent"
      >
        <span className="truncate">{active.name}</span>
        <ChevronsUpDown className="size-4 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {workspaces.map((w) => (
          <DropdownMenuItem key={w.id} onClick={() => switchTo(w.id)}>
            <span className="flex-1 truncate">{w.name}</span>
            {w.kind && w.kind !== "internal" && (
              <span className="rounded-lg bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                {w.kind}
              </span>
            )}
            {w.id === active.id && <Check className="size-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
