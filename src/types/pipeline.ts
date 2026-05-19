export const DEAL_STAGES = ["discovery", "scope", "proposal", "build", "live", "lost"] as const;
export type DealStage = (typeof DEAL_STAGES)[number];

export const STAGE_LABEL: Record<DealStage, string> = {
  discovery: "Discovery Call",
  scope: "Scope Draft",
  proposal: "Proposal Sent",
  build: "Build",
  live: "Live",
  lost: "Lost",
};

export const STAGE_COLOR: Record<DealStage, string> = {
  discovery: "#00B4D8",
  scope: "#A78BFA",
  proposal: "#F59E0B",
  build: "#3B82F6",
  live: "#10B981",
  lost: "#EF4444",
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
  created_at: string;
  updated_at: string;
  closed_at: string | null;
};

export type DealWithLinks = CrmDeal & {
  company: Pick<CrmCompany, "id" | "name" | "domain" | "industry"> | null;
  contact: Pick<CrmContact, "id" | "full_name" | "title" | "email" | "phone"> | null;
};
