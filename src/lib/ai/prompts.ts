function buildWorkspaceDetectionRules(
  workspaces: { name: string; slug: string; type: string }[]
): string {
  if (workspaces.length === 0) {
    return "- No workspaces configured";
  }

  return workspaces
    .map((w) => {
      if (w.type === "personal") {
        return `- Personal errands, groceries, gym, family, friends → "${w.slug}"`;
      }
      // Business workspace: mention the workspace name and related keywords
      return `- Mentions of "${w.name}", business related to ${w.name} → "${w.slug}"`;
    })
    .join("\n");
}

export function getSystemPrompt(context: {
  currentDate: string;
  timezone: string;
  workspaces: { name: string; slug: string; type: string }[];
}) {
  return `You are the AI command hub for Command Center, a productivity app. Parse natural language into structured actions.

Current date/time: ${context.currentDate}
Timezone: ${context.timezone}

Available workspaces:
${context.workspaces.map((w) => `- "${w.name}" (slug: "${w.slug}", type: ${w.type})`).join("\n")}

## Rules

### Intent Detection
- "book", "schedule", "meeting", "appointment", "call" → create_event
- "add task", "todo", "remind me to", "need to", "don't forget" → create_task
- "move", "reschedule", "push", "change to" → reschedule
- "cancel", "delete", "remove" → cancel
- "what's my schedule", "what do I have", "am I free" → query_schedule
- "find time", "when can I", "open slot" → find_free_time

### Workspace Detection
${buildWorkspaceDetectionRules(context.workspaces)}
- If unclear, omit workspace_slug (user will pick)

### Time Defaults
- Meetings default to 60 minutes unless specified
- "Quick call" or "quick chat" → 30 minutes
- "Lunch" or "coffee" → 60 minutes
- "All day" events have no specific time
- If only a start time is given, use the default duration
- "Morning" → 9:00 AM, "Afternoon" → 1:00 PM, "Evening" → 6:00 PM

### Date Parsing
- "Tomorrow" → next day from current date
- "Next Monday" → the coming Monday (not today if today is Monday)
- "Friday" → the next upcoming Friday
- "This week" → current week
- "Next week" → the week after current

### display_text
Always include a concise human-readable confirmation, e.g.:
- "Meeting with Alex — Fri Mar 28, 10:00 AM - 11:00 AM at Starbucks, Blakeney Shopping Center"
- "Task: Buy groceries — Due Friday, Mar 28"

Respond with valid JSON matching the schema exactly. Do not include any text outside the JSON.`;
}

export const AI_PARSE_TOOLS = [
  {
    name: "parse_command" as const,
    description:
      "Parse a natural language command into a structured action for the Command Center app.",
    input_schema: {
      type: "object" as const,
      properties: {
        intent: {
          type: "string",
          enum: [
            "create_event",
            "create_task",
            "reschedule",
            "cancel",
            "query_schedule",
            "find_free_time",
            "unknown",
          ],
          description: "The detected intent of the user command",
        },
        confidence: {
          type: "number",
          description: "Confidence score from 0 to 1",
        },
        event: {
          type: "object",
          properties: {
            title: { type: "string" },
            start_time: {
              type: "string",
              description: "ISO 8601 datetime",
            },
            end_time: {
              type: "string",
              description: "ISO 8601 datetime",
            },
            location: { type: "string" },
            workspace_slug: { type: "string" },
            attendees: {
              type: "array",
              items: { type: "string" },
            },
            meeting_type: {
              type: "string",
              enum: ["zoom", "teams"],
            },
            all_day: { type: "boolean" },
          },
          required: ["title", "start_time", "end_time"],
        },
        task: {
          type: "object",
          properties: {
            title: { type: "string" },
            due_date: {
              type: "string",
              description: "ISO 8601 date",
            },
            priority: {
              type: "string",
              enum: ["none", "low", "medium", "high"],
            },
            workspace_slug: { type: "string" },
            estimated_minutes: { type: "number" },
          },
          required: ["title"],
        },
        reschedule: {
          type: "object",
          properties: {
            search_title: { type: "string" },
            new_start_time: {
              type: "string",
              description: "ISO 8601 datetime",
            },
            new_end_time: {
              type: "string",
              description: "ISO 8601 datetime",
            },
          },
          required: ["search_title", "new_start_time", "new_end_time"],
        },
        cancel: {
          type: "object",
          properties: {
            search_title: {
              type: "string",
              description: "Title or keyword to find the event/task to cancel",
            },
            entity_type: {
              type: "string",
              enum: ["event", "task"],
              description: "Whether to cancel an event or a task",
            },
          },
          required: ["search_title", "entity_type"],
        },
        query: {
          type: "object",
          properties: {
            date_range_start: { type: "string" },
            date_range_end: { type: "string" },
            summary_request: { type: "string" },
          },
          required: ["date_range_start", "date_range_end", "summary_request"],
        },
        display_text: {
          type: "string",
          description:
            "Human-readable confirmation text for the parsed command",
        },
      },
      required: ["intent", "confidence", "display_text"],
    },
  },
];
