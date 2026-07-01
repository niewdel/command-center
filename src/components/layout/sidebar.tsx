"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { TrendingUp, Gauge, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

const agentsNav = [
  { name: "Visibility Agent", href: "/seo", icon: TrendingUp },
  { name: "Site Audit Agent", href: "/audits", icon: Gauge },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <aside
      data-slot="sidebar"
      className="hidden md:flex fixed inset-y-0 left-0 z-40 w-[var(--sidebar-width)] flex-col bg-sidebar border-r border-sidebar-border"
    >
      {/* Header — Niewdel wordmark, blue dot as the only ornament */}
      <div className="flex items-center gap-2 px-5 py-5 border-b border-sidebar-border">
        <Image
          src="/logos/niewdel-wordmark.png"
          alt="Niewdel"
          width={880}
          height={186}
          className="h-5 w-auto"
          priority
        />
        <span aria-hidden="true" className="size-1.5 rounded-full bg-primary" />
      </div>

      {/* Navigation — agents only */}
      <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
        <p className="eyebrow-blue px-2.5 pb-2">Agents</p>
        {agentsNav.map((item) => (
          <NavRow
            key={item.href}
            href={item.href}
            icon={item.icon}
            label={item.name}
            active={pathname === item.href || pathname.startsWith(item.href + "/")}
          />
        ))}
      </nav>

      {/* Bottom action */}
      <div className="p-3 border-t border-sidebar-border">
        <button
          onClick={handleSignOut}
          className="w-full flex items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors"
        >
          <LogOut className="size-3.5" />
          Sign out
        </button>
      </div>
    </aside>
  );
}

function NavRow({
  href,
  icon: Icon,
  label,
  active,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-lg px-2.5 py-2.5 text-sm font-medium transition-colors",
        active
          ? "bg-[var(--rust-tint)] text-foreground"
          : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
      )}
    >
      <Icon
        className={cn(
          "size-4 shrink-0 transition-colors",
          active ? "text-primary" : "text-muted-foreground"
        )}
      />
      <span>{label}</span>
    </Link>
  );
}
