"use client";

import { cn } from "@/lib/utils";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { SkeletonPage } from "@/components/ui/skeleton";
import type { LucideIcon } from "lucide-react";

type BreadcrumbItem = { label: string; href?: string };

type PageLayoutProps = {
  title: string;
  description?: string;
  icon?: LucideIcon;
  iconColor?: string;
  actions?: React.ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  maxWidth?: "sm" | "md" | "lg" | "xl";
  loading?: boolean;
  children: React.ReactNode;
};

const maxWidthMap = {
  sm: "max-w-2xl",
  md: "max-w-3xl",
  lg: "max-w-4xl",
  xl: "max-w-5xl",
};

export function PageLayout({
  title,
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
    <div className={cn("p-4 md:p-8 pb-24 md:pb-8 mx-auto space-y-5", maxWidthMap[maxWidth])}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <Breadcrumb items={breadcrumbs} className="pt-1" />
      )}

      <div className={cn("flex items-center justify-between gap-4", !breadcrumbs && "pt-1")}>
        <div className="flex items-center gap-2 min-w-0">
          {Icon && <Icon className="size-5 text-primary shrink-0" />}
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-balance font-heading truncate tracking-tight">{title}</h1>
            {description && (
              <p className="text-xs text-muted-foreground text-pretty mt-0.5">{description}</p>
            )}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>

      {children}
    </div>
  );
}
