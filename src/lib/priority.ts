export const PRIORITY_CONFIG = {
  none: { dot: "bg-transparent", text: "text-muted-foreground", label: "" },
  low: { dot: "bg-blue-500", text: "text-blue-400", label: "Low" },
  medium: { dot: "bg-amber-500", text: "text-amber-400", label: "Medium" },
  high: { dot: "bg-red-500", text: "text-red-400", label: "High" },
} as const;

export type Priority = keyof typeof PRIORITY_CONFIG;
