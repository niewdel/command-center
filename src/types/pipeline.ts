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
