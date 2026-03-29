const AI_TRIGGER_WORDS = [
  // Action verbs
  "book",
  "schedule",
  "create",
  "add",
  "set",
  "move",
  "reschedule",
  "cancel",
  "delete",
  "remove",
  "push",
  "remind",
  // Task triggers
  "todo",
  "task",
  "need to",
  "don't forget",
  "remember to",
  // Query triggers
  "what's my",
  "what do i have",
  "am i free",
  "when can i",
  "find time",
  "open slot",
  "show me",
  // Temporal
  "tomorrow",
  "today",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
  "next week",
  "this week",
  "morning",
  "afternoon",
  "evening",
];

const TIME_PATTERN = /\b\d{1,2}(:\d{2})?\s*(am|pm)\b/i;

export function isAiInput(query: string): boolean {
  if (!query.trim()) return false;

  // Force AI mode with / prefix
  if (query.startsWith("/")) return true;

  const lower = query.toLowerCase();

  // Check for time patterns
  if (TIME_PATTERN.test(lower)) return true;

  // Check for trigger words
  return AI_TRIGGER_WORDS.some((word) => lower.includes(word));
}

export function formatEventTime(startTime: string, endTime: string, allDay?: boolean): string {
  if (allDay) {
    return new Date(startTime).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }

  const start = new Date(startTime);
  const end = new Date(endTime);

  const dateStr = start.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  const startTimeStr = start.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  const endTimeStr = end.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  return `${dateStr}, ${startTimeStr} - ${endTimeStr}`;
}

export function cleanAiInput(query: string): string {
  // Remove / prefix if present
  if (query.startsWith("/")) return query.slice(1).trim();
  return query.trim();
}
