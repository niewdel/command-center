export type CompanyStatus =
  | "new"
  | "researched"
  | "outreach_ready"
  | "in_sequence"
  | "replied"
  | "qualified"
  | "disqualified";

export type RoleType =
  | "decision_maker"
  | "influencer"
  | "champion"
  | "end_user"
  | "unknown";

export type EmailStatus =
  | "draft"
  | "approved"
  | "scheduled"
  | "sent"
  | "bounced"
  | "failed";

export type Organization = {
  id: string;
  user_id: string | null;
  name: string;
  created_at: string;
};

export type Vertical = {
  id: string;
  org_id: string;
  name: string;
  icp: Record<string, unknown>;
  scrape_params: Record<string, unknown>;
  outreach_config: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Company = {
  id: string;
  org_id: string;
  vertical_id: string | null;
  name: string;
  domain: string | null;
  website: string | null;
  industry: string | null;
  revenue_range: string | null;
  headcount: number | null;
  city: string | null;
  state: string | null;
  country: string | null;
  source: string;
  source_id: string | null;
  research_profile: Record<string, unknown> | null;
  research_summary: string | null;
  researched_at: string | null;
  status: CompanyStatus;
  created_at: string;
  updated_at: string;
};

export type Contact = {
  id: string;
  org_id: string;
  company_id: string;
  full_name: string;
  first_name: string | null;
  last_name: string | null;
  title: string | null;
  email: string | null;
  email_verified: boolean;
  linkedin_url: string | null;
  role_type: RoleType;
  source: string;
  source_id: string | null;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
};

export type Sequence = {
  id: string;
  org_id: string;
  vertical_id: string;
  name: string;
  steps: number;
  delay_days: number[];
  is_active: boolean;
  created_at: string;
};

export type OutreachEmail = {
  id: string;
  org_id: string;
  contact_id: string;
  sequence_id: string | null;
  step_number: number;
  subject: string | null;
  body_html: string | null;
  body_plain: string | null;
  status: EmailStatus;
  smartlead_id: string | null;
  sent_at: string | null;
  opened_at: string | null;
  replied_at: string | null;
  open_count: number;
  click_count: number;
  generated_by: string | null;
  prompt_version: string | null;
  created_at: string;
  updated_at: string;
};

export type PipelineEvent = {
  id: string;
  org_id: string;
  company_id: string | null;
  contact_id: string | null;
  event_type: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type LeadStats = {
  companies: { total: number; byStatus: Record<string, number> };
  contacts: { total: number };
  emails: { total: number; byStatus: Record<string, number> };
  verticals: Array<Pick<Vertical, "id" | "name" | "is_active">>;
  events: Record<string, number>;
};
