// First-login onboarding tour + activation checklist. Server-persisted in
// `user_onboarding` (migration-037), RLS-scoped to auth.uid(). Never stored
// in localStorage — the browser Supabase client carries the user's session
// and RLS does the scoping.

export const CHECKLIST_ITEMS = [
  "create_first_deal",
  "add_contact_and_log_activity",
  "set_next_action",
  "explore_my_day",
  "view_dashboard",
] as const;

export type ChecklistKey = (typeof CHECKLIST_ITEMS)[number];

export const CHECKLIST_LABEL: Record<ChecklistKey, string> = {
  create_first_deal: "Create your first deal",
  add_contact_and_log_activity: "Add a contact and log an activity",
  set_next_action: "Set a next action on a deal",
  explore_my_day: "Explore My Day",
  view_dashboard: "View your dashboard",
};

// Loosely typed (not just ChecklistKey) so the widget can also persist a
// "dismissed" flag in the same jsonb bag without a schema change.
export type OnboardingChecklist = Partial<Record<ChecklistKey, boolean>> & {
  dismissed?: boolean;
};

export const CHECKLIST_DISMISSED_KEY = "dismissed" as const;

export type OnboardingState = {
  completedAt: string | null;
  step: number;
  checklist: OnboardingChecklist;
};

export type TourStepSide = "top" | "right" | "bottom" | "left";

export type TourStep = {
  /** CSS selector, typically `[data-tour="..."]`. */
  element: string;
  title: string;
  body: string;
  side?: TourStepSide;
};
