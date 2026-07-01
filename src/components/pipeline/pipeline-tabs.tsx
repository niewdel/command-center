"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { label: "My Day", href: "/pipeline/my-day", tour: "my-day" },
  { label: "Pipeline", href: "/pipeline" },
  { label: "Clients", href: "/pipeline/clients" },
  { label: "Companies", href: "/pipeline/companies" },
  { label: "Proposals", href: "/pipeline/proposals" },
  { label: "Revenue", href: "/pipeline/revenue" },
  { label: "Dashboard", href: "/pipeline/dashboard", tour: "dashboard" },
] as const;

export function PipelineTabs() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 border-b border-border -mt-2 mb-4 overflow-x-auto">
      {TABS.map((tab) => {
        const active =
          tab.href === "/pipeline"
            ? pathname === "/pipeline" || pathname.startsWith("/pipeline/deals")
            : tab.href === "/pipeline/clients"
              ? pathname.startsWith("/pipeline/clients") || pathname.startsWith("/pipeline/contacts")
              : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            data-tour={"tour" in tab ? tab.tour : undefined}
            className={cn(
              "px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
              active
                ? "text-foreground border-foreground"
                : "text-muted-foreground border-transparent hover:text-foreground"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
