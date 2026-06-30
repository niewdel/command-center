// src/components/seo/report/metric-card.tsx
import { type ReactNode } from "react";
import { Delta } from "./delta";

interface MetricCardProps {
  label: string;
  value: ReactNode;       // big primary value (number or string)
  delta?: number | null;
  deltaFormat?: "number" | "percent" | "rank";
  deltaDirection?: "higher-better" | "lower-better";
  secondary?: ReactNode;  // small secondary text below the number (e.g. "Lifetime: 3,071")
  size?: "hero" | "default";
  className?: string;
}

export function MetricCard({
  label,
  value,
  delta,
  deltaFormat = "number",
  deltaDirection = "higher-better",
  secondary,
  size = "default",
  className = "",
}: MetricCardProps) {
  const valueClasses =
    size === "hero"
      ? "text-5xl font-semibold text-foreground font-data tracking-tight"
      : "text-3xl font-semibold text-foreground font-data tracking-tight";
  return (
    <div className={`report-card p-6 ${className}`}>
      <div className="report-label mb-3">{label}</div>
      <div className={valueClasses}>{value}</div>
      <div className="mt-2 flex items-center gap-3">
        {delta !== undefined && (
          <Delta
            value={delta}
            format={deltaFormat}
            direction={deltaDirection}
          />
        )}
        {secondary && (
          <div className="text-muted-foreground text-xs">{secondary}</div>
        )}
      </div>
    </div>
  );
}
