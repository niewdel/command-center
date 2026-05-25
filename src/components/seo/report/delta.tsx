// src/components/seo/report/delta.tsx
//
// Editorial direction (v2.1): show all deltas, but in warm semantic
// colors. Improvement = sage (chart-2), regression = destructive,
// no signal = muted. No emerald or neon red. Brand-consistent with
// the email renderer in src/lib/seo/monthly-report-email.ts.
//
// `direction` controls whether higher or lower counts as improvement.

interface DeltaProps {
  value: number | null;
  format?: "number" | "percent" | "rank";
  direction?: "higher-better" | "lower-better";
  className?: string;
}

export function Delta({
  value,
  format = "number",
  direction = "higher-better",
  className = "",
}: DeltaProps) {
  if (value == null || value === 0) {
    return (
      <span className={`text-muted-foreground tabular-nums text-sm ${className}`}>
        —
      </span>
    );
  }
  const isImprovement =
    direction === "higher-better" ? value > 0 : value < 0;
  const color = isImprovement ? "text-[var(--chart-2)]" : "text-destructive";
  const arrow = value > 0 ? "↑" : "↓";
  const abs = Math.abs(value);
  const formatted =
    format === "percent"
      ? `${abs}%`
      : format === "rank"
        ? abs.toString()
        : abs.toLocaleString();
  return (
    <span className={`${color} tabular-nums text-sm font-data ${className}`}>
      {arrow} {formatted}
    </span>
  );
}
