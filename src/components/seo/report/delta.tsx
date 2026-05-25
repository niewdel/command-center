// src/components/seo/report/delta.tsx
//
// Editorial direction (v2): client-facing reports show progress, not
// regression. When a metric moves the WRONG way we render a neutral
// placeholder ("—") rather than a red down-arrow. Niewdel is responsible
// for these numbers and the report shouldn't read as bad news.
//
// `direction` controls whether higher or lower is the improvement.

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

  // Suppress regression. Render as if no signal.
  if (!isImprovement) {
    return (
      <span className={`text-muted-foreground tabular-nums text-sm ${className}`}>
        —
      </span>
    );
  }

  const arrow = "↑";
  const abs = Math.abs(value);
  const formatted =
    format === "percent"
      ? `${abs}%`
      : format === "rank"
        ? abs.toString()
        : abs.toLocaleString();
  return (
    <span className={`text-[var(--chart-2)] tabular-nums text-sm font-data ${className}`}>
      {arrow} {formatted}
    </span>
  );
}
