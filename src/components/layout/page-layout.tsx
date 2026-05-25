"use client";

import { cn } from "@/lib/utils";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { SkeletonPage } from "@/components/ui/skeleton";
import type { LucideIcon } from "lucide-react";

type BreadcrumbItem = { label: string; href?: string };

type PageLayoutProps = {
  title: string;
  /** Mono eyebrow label rendered above the title, matches brand "01 · LOGOS"
   *  pattern. Opt-in: omit to skip, since most pages already have a clear title. */
  eyebrow?: string | null;
  description?: string;
  icon?: LucideIcon;
  iconColor?: string;
  actions?: React.ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "full";
  loading?: boolean;
  children: React.ReactNode;
};

const maxWidthMap = {
  sm: "max-w-2xl",
  md: "max-w-3xl",
  lg: "max-w-4xl",
  xl: "max-w-5xl",
  "2xl": "max-w-7xl",
  full: "max-w-none",
};

export function PageLayout({
  title,
  eyebrow,
  description,
  icon: Icon,
  actions,
  breadcrumbs,
  maxWidth = "md",
  loading,
  children,
}: PageLayoutProps) {
  if (loading) {
    return <SkeletonPage />;
  }

  return (
    <div className={cn("p-4 md:p-10 pb-24 md:pb-10 mx-auto space-y-6", maxWidthMap[maxWidth])}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <Breadcrumb items={breadcrumbs} className="pt-1" />
      )}

      <header className={cn("space-y-3", !breadcrumbs && "pt-2")}>
        <div className="flex items-end justify-between gap-6">
          <div className="min-w-0 space-y-2">
            {eyebrow && (
              <span className="mono-tag block">{eyebrow}</span>
            )}
            <div className="flex items-center gap-3 min-w-0">
              {Icon && <Icon className="size-7 md:size-8 text-foreground shrink-0" strokeWidth={1.75} />}
              <h1 className="text-3xl md:text-[2.25rem] leading-[1.05] font-bold text-balance font-heading truncate">
                {title}
              </h1>
            </div>
            {description && (
              <p className="text-sm text-muted-foreground text-pretty max-w-[60ch]">
                {description}
              </p>
            )}
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0 pb-1">{actions}</div>}
        </div>
        <hr className="border-t border-border" />
      </header>

      {children}
    </div>
  );
}
