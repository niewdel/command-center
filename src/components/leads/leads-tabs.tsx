"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { label: "Stats", href: "/leads" },
  { label: "Prospects", href: "/leads/prospects" },
  { label: "Companies", href: "/leads/companies" },
  { label: "Contacts", href: "/leads/contacts" },
  { label: "Emails", href: "/leads/emails" },
];

export function LeadsTabs() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 border-b border-border -mt-2 mb-4 overflow-x-auto">
      {TABS.map((tab) => {
        const active =
          tab.href === "/leads"
            ? pathname === "/leads"
            : pathname.startsWith(tab.href);

        return (
          <Link
            key={tab.href}
            href={tab.href}
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
