export type RecurrenceRule = {
  frequency: "daily" | "weekly" | "monthly";
  interval: number;
  days_of_week?: number[]; // 0=Sun, 1=Mon, ..., 6=Sat
};

export function parseRecurrenceRule(json: string | null): RecurrenceRule | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as RecurrenceRule;
  } catch {
    return null;
  }
}

export function serializeRecurrenceRule(rule: RecurrenceRule): string {
  return JSON.stringify(rule);
}

export function computeNextOccurrence(
  completedDate: string,
  rule: RecurrenceRule
): string {
  const date = new Date(completedDate + "T00:00:00");

  switch (rule.frequency) {
    case "daily":
      date.setDate(date.getDate() + rule.interval);
      break;

    case "weekly":
      if (rule.days_of_week && rule.days_of_week.length > 0) {
        // Find the next matching day of week
        const sorted = [...rule.days_of_week].sort((a, b) => a - b);
        const currentDay = date.getDay();
        // Look for the next day in the same week
        const nextDay = sorted.find((d) => d > currentDay);
        if (nextDay !== undefined) {
          date.setDate(date.getDate() + (nextDay - currentDay));
        } else {
          // Wrap to next interval's first day
          const daysUntilNextWeek = 7 * rule.interval - currentDay + sorted[0];
          date.setDate(date.getDate() + daysUntilNextWeek);
        }
      } else {
        date.setDate(date.getDate() + 7 * rule.interval);
      }
      break;

    case "monthly": {
      const targetDay = date.getDate();
      date.setMonth(date.getMonth() + rule.interval);
      // Clamp to last day of month if needed (e.g., Jan 31 → Feb 28)
      if (date.getDate() !== targetDay) {
        date.setDate(0); // Go to last day of previous month
      }
      break;
    }
  }

  return date.toISOString().split("T")[0];
}

export function describeRecurrence(rule: RecurrenceRule): string {
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  if (rule.frequency === "daily") {
    return rule.interval === 1 ? "Daily" : `Every ${rule.interval} days`;
  }

  if (rule.frequency === "weekly") {
    const base = rule.interval === 1 ? "Weekly" : `Every ${rule.interval} weeks`;
    if (rule.days_of_week && rule.days_of_week.length > 0) {
      const days = rule.days_of_week.map((d) => dayNames[d]).join(", ");
      return `${base} on ${days}`;
    }
    return base;
  }

  if (rule.frequency === "monthly") {
    return rule.interval === 1 ? "Monthly" : `Every ${rule.interval} months`;
  }

  return "Custom";
}
