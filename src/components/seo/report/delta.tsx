// src/components/seo/report/delta.tsx
//
// For SEO scores higher is better, but for keyword ranks lower is better.
// `direction` lets the caller flip the color logic.

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
  const color = isImprovement ? "text-emerald-400" : "text-destructive";
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
