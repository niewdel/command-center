export type Workspace = {
  id: string;
  name: string;
  slug: string;
  type: "business" | "personal";
  color: string;
  description: string | null;
  logo_url: string | null;
  icon: string;
  position: number;
  created_at: string;
};

export type Task = {
  id: string;
  workspace_id: string;
  project_id: string | null;
  client_id: string | null;
  goal_id: string | null;
  title: string;
  description: string | null;
  status: "todo" | "in_progress" | "done";
  priority: "none" | "low" | "medium" | "high";
  due_date: string | null;
  planned_date: string | null;
  estimated_minutes: number | null;
  actual_minutes: number | null;
  is_focus: boolean;
  position: number;
  is_recurring: boolean;
  recurrence_rule: string | null;
  source: "manual" | "telegram" | "fathom" | "hubspot" | "calendar" | "ai";
  source_id: string | null;
  completed_at: string | null;
  created_at: string;
  scheduled_start: string | null;
  scheduled_end: string | null;
  calendar_event_id: string | null;
};

export type TaskWithWorkspace = Task & {
  workspace: Workspace;
};

export type Client = {
  id: string;
  workspace_id: string;
  name: string;
  type: "full" | "lightweight";
  notes: string | null;
  links: { label: string; url: string }[];
  created_at: string;
};

export type Project = {
  id: string;
  workspace_id: string;
  client_id: string | null;
  name: string;
  description: string | null;
  status: "active" | "completed" | "on_hold";
  created_at: string;
};

export type Note = {
  id: string;
  workspace_id: string;
  client_id: string | null;
  project_id: string | null;
  title: string;
  content: string | null;
  type: "note" | "meeting";
  source: "manual" | "fathom";
  source_id: string | null;
  meeting_date: string | null;
  attendees: string[] | null;
  created_at: string;
};

export type Goal = {
  id: string;
  workspace_id: string;
  title: string;
  description: string | null;
  type: "business" | "personal";
  status: "active" | "completed" | "abandoned";
  target_date: string | null;
  created_at: string;
};

export type CalendarConnection = {
  id: string;
  user_id: string;
  provider: "google" | "microsoft" | "apple";
  account_email: string;
  access_token: string;
  refresh_token: string | null;
  token_expires_at: string | null;
  calendar_ids: string[];
  sync_cursor: string | null;
  last_synced_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CalendarEvent = {
  id: string;
  user_id: string;
  workspace_id: string | null;
  connection_id: string | null;
  external_id: string | null;
  external_calendar_id: string | null;
  title: string;
  description: string | null;
  location: string | null;
  start_time: string;
  end_time: string;
  all_day: boolean;
  timezone: string;
  status: "confirmed" | "tentative" | "cancelled";
  recurrence_rule: string | null;
  meeting_url: string | null;
  meeting_provider: "zoom" | "teams" | "google_meet" | "other" | null;
  attendees: { email: string; name?: string; status?: string }[];
  color: string | null;
  source: "local" | "google" | "microsoft" | "apple";
  is_read_only: boolean;
  raw_data: Record<string, unknown> | null;
  task_id: string | null;
  created_at: string;
  updated_at: string;
};

export type CalendarEventWithTask = CalendarEvent & {
  task?: Task;
};

export type MeetingConnection = {
  id: string;
  user_id: string;
  provider: "zoom" | "teams";
  access_token: string;
  refresh_token: string | null;
  token_expires_at: string | null;
  account_email: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type AiCommandLog = {
  id: string;
  user_id: string;
  raw_input: string;
  parsed_intent: string | null;
  parsed_data: Record<string, unknown> | null;
  action_taken: string | null;
  entity_type: string | null;
  entity_id: string | null;
  confidence: number | null;
  source: "command_bar" | "telegram" | "voice" | "quick_add";
  duration_ms: number | null;
  created_at: string;
};

export type AiParseResult = {
  intent:
    | "create_event"
    | "create_task"
    | "reschedule"
    | "cancel"
    | "query_schedule"
    | "find_free_time"
    | "unknown";
  confidence: number;
  event?: {
    title: string;
    start_time: string;
    end_time: string;
    location?: string;
    workspace_slug?: string;
    attendees?: string[];
    meeting_type?: "zoom" | "teams" | null;
    all_day?: boolean;
  };
  task?: {
    title: string;
    due_date?: string;
    priority?: "none" | "low" | "medium" | "high";
    workspace_slug?: string;
    estimated_minutes?: number;
  };
  reschedule?: {
    search_title: string;
    new_start_time: string;
    new_end_time: string;
  };
  cancel?: {
    search_title: string;
    entity_type: "event" | "task";
  };
  query?: {
    date_range_start: string;
    date_range_end: string;
    summary_request: string;
  };
  display_text: string;
};

export type ContentDigest = {
  id: string;
  user_id: string;
  url: string;
  source: "youtube" | "instagram" | "unknown";
  status: "queued" | "processing" | "completed" | "failed";
  title: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  transcript: string | null;
  guide: string | null;
  tags: string[];
  error_message: string | null;
  slack_message_ts: string | null;
  slack_channel_id: string | null;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type UserSettings = {
  id: string;
  user_id: string;
  available_hours_weekday: number;
  available_hours_weekend: number;
  shutdown_time: string;
  planning_completed_date: string | null;
  shutdown_completed_date: string | null;
  daily_intention: string | null;
  created_at: string;
  updated_at: string;
};
