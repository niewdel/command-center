export const DEAL_STAGES = [
  "discovery",
  "scope",
  "proposal",
  "build",
  "live",
  "lost",
  "disqualified",
] as const;
export type DealStage = (typeof DEAL_STAGES)[number];

export const STAGE_LABEL: Record<DealStage, string> = {
  discovery: "Discovery Call",
  scope: "Scope Draft",
  proposal: "Proposal Sent",
  build: "Build",
  live: "Live",
  lost: "Lost",
  disqualified: "Disqualified",
};

// Stage colors — warm palette only. Cyan / teal / neon blue are off-brand
// (Niewdel Brand Guidelines v2). Each tone moves further along a "fresh →
// resolved" arc.
export const STAGE_COLOR: Record<DealStage, string> = {
  discovery: "#B58A5C",   // warm tan — incoming
  scope: "#8C6A47",       // saddle brown — under study
  proposal: "#C89B3C",    // gold — proposal out
  build: "#6B4A2E",       // walnut — committed work
  live: "#5C7F4F",        // sage — won
  lost: "#8F3623",        // accent deep rust — failed
  // Warm stone — "we walked away (wrong fit)" reads as neutral rather
  // than as a loss.
  disqualified: "#807870",
};

export const ACTIVE_STAGES: DealStage[] = ["discovery", "scope", "proposal", "build"];

export type CrmCompany = {
  id: string;
  workspace_id: string;
  name: string;
  domain: string | null;
  website: string | null;
  industry: string | null;
  headcount: number | null;
  hq: string | null;
  notes: string | null;
  source_prospect_company_id: string | null;
  owner: string | null;
  created_at: string;
  updated_at: string;
};

export type CrmContact = {
  id: string;
  workspace_id: string;
  crm_company_id: string | null;
  full_name: string;
  first_name: string | null;
  last_name: string | null;
  title: string | null;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  notes: string | null;
  source_prospect_contact_id: string | null;
  created_at: string;
  updated_at: string;
};

export type CrmDeal = {
  id: string;
  workspace_id: string;
  crm_company_id: string | null;
  primary_contact_id: string | null;
  title: string;
  stage: DealStage;
  value_cents: number | null;
  close_date_est: string | null;
  notes: string | null;
  owner: string | null;
  lost_reason: string | null;
  position: number;
  proposal_url: string | null;
  proposal_filename: string | null;
  fathom_url: string | null;
  /** Next scheduled touch on this deal. Null/past-due = "going stale". */
  next_action_at: string | null;
  /** Manual override (0-100). Falls back to STAGE_PROBABILITY[stage] when null. */
  probability: number | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
};

export type DealWithLinks = CrmDeal & {
  company: Pick<CrmCompany, "id" | "name" | "domain" | "industry"> | null;
  contact: Pick<CrmContact, "id" | "full_name" | "title" | "email" | "phone"> | null;
  /** PostgREST returns `[{ count: N }]` for the embedded count aggregate. */
  contact_count?: { count: number }[];
};

// ---------------------------------------------------------------------------
// CRM elevation (migration-037): activity timeline, tasks/"My Day", weighted
// forecast, saved views, onboarding.
// ---------------------------------------------------------------------------

/** Default win probability by stage, used when crm_deals.probability is null. */
export const STAGE_PROBABILITY: Record<DealStage, number> = {
  discovery: 10,
  scope: 25,
  proposal: 50,
  build: 75,
  live: 100,
  lost: 0,
  disqualified: 0,
};

/** Resolve a deal's forecast probability: manual override, else stage default. */
export function resolveDealProbability(deal: Pick<CrmDeal, "stage" | "probability">): number {
  return deal.probability ?? STAGE_PROBABILITY[deal.stage];
}

export const ACTIVITY_TYPES = ["note", "call", "email", "meeting", "stage_change"] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const ACTIVITY_TYPE_LABEL: Record<ActivityType, string> = {
  note: "Note",
  call: "Call",
  email: "Email",
  meeting: "Meeting",
  stage_change: "Stage change",
};

export type CrmActivity = {
  id: string;
  workspace_id: string;
  deal_id: string | null;
  crm_company_id: string | null;
  contact_id: string | null;
  type: ActivityType;
  body: string | null;
  occurred_at: string;
  created_by: string | null;
  created_at: string;
};

export type CrmTask = {
  id: string;
  workspace_id: string;
  deal_id: string | null;
  crm_company_id: string | null;
  contact_id: string | null;
  title: string;
  due_date: string | null;
  done: boolean;
  created_by: string | null;
  created_at: string;
};

export const SAVED_VIEW_ENTITIES = ["deals", "contacts", "companies"] as const;
export type SavedViewEntity = (typeof SAVED_VIEW_ENTITIES)[number];

export type CrmSavedView = {
  id: string;
  workspace_id: string;
  user_id: string;
  entity: SavedViewEntity;
  name: string;
  /** Shape is entity-specific (stage filter, owner filter, sort, etc). */
  filter_json: Record<string, unknown>;
  created_at: string;
};

export type UserOnboardingState = {
  user_id: string;
  onboarding_completed_at: string | null;
  onboarding_step: number;
  /** e.g. { first_deal: true, first_activity: false, ... } */
  onboarding_checklist: Record<string, boolean>;
  created_at: string;
  updated_at: string;
};
