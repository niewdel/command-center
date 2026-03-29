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
  iconColor,
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
    <div className={cn("p-4 md:p-8 pb-24 md:pb-8 mx-auto space-y-6", maxWidthMap[maxWidth])}>
      {/* Breadcrumbs */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <Breadcrumb items={breadcrumbs} className="pt-2" />
      )}

      {/* Header */}
      <div className={cn("flex items-start justify-between gap-4", !breadcrumbs && "pt-2")}>
        <div className="flex items-center gap-3 min-w-0">
          {Icon && (
            <div className={cn("size-10 rounded-lg flex items-center justify-center shrink-0", iconColor || "bg-foreground")}>
              <Icon className="size-5 text-background" />
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-balance font-heading truncate">{title}</h1>
            {description && (
              <p className="text-sm text-muted-foreground text-pretty">{description}</p>
            )}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>

      {/* Content */}
      {children}
    </div>
  );
}
