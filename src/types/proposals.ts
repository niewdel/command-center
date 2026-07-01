// src/types/proposals.ts
//
// Types for the proposal builder + internal e-sign (migration-038-proposals.sql).
// Matches the string-literal-union + label-map + row-type style of
// src/types/pipeline.ts.

export const PROPOSAL_TYPES = [
  "website_build",
  "retainer",
  "lead_gen",
  "ai_phased",
  "custom",
] as const;
export type ProposalType = (typeof PROPOSAL_TYPES)[number];

export const PROPOSAL_TYPE_LABEL: Record<ProposalType, string> = {
  website_build: "Website Build",
  retainer: "Retainer",
  lead_gen: "Lead Gen",
  ai_phased: "AI Phased Rollout",
  custom: "Custom",
};

export const PROPOSAL_STATUSES = [
  "draft",
  "sent",
  "viewed",
  "signed",
  "declined",
  "void",
] as const;
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];

export const PROPOSAL_STATUS_LABEL: Record<ProposalStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  viewed: "Viewed",
  signed: "Signed",
  declined: "Declined",
  void: "Void",
};

// Warm palette only, matching STAGE_COLOR in src/types/pipeline.ts.
export const PROPOSAL_STATUS_COLOR: Record<ProposalStatus, string> = {
  draft: "#807870",
  sent: "#C89B3C",
  viewed: "#B58A5C",
  signed: "#5C7F4F",
  declined: "#8F3623",
  void: "#807870",
};

export const PROPOSAL_THEMES = ["dark", "light"] as const;
export type ProposalTheme = (typeof PROPOSAL_THEMES)[number];

export const LINE_ITEM_KINDS = ["one_time", "recurring", "handoff"] as const;
export type LineItemKind = (typeof LINE_ITEM_KINDS)[number];

export const LINE_ITEM_KIND_LABEL: Record<LineItemKind, string> = {
  one_time: "One-time",
  recurring: "Recurring",
  handoff: "Handoff",
};

export const LINE_ITEM_CADENCES = [
  "one_time",
  "per_month",
  "at_handoff",
  "at_launch",
  "upfront",
] as const;
export type LineItemCadence = (typeof LINE_ITEM_CADENCES)[number];

export const LINE_ITEM_CADENCE_LABEL: Record<LineItemCadence, string> = {
  one_time: "One-time",
  per_month: "Per month",
  at_handoff: "At handoff",
  at_launch: "At launch",
  upfront: "Upfront",
};

export const PROPOSAL_EVENT_TYPES = [
  "created",
  "sent",
  "viewed",
  "signed",
  "countersigned",
  "declined",
  "downloaded",
] as const;
export type ProposalEventType = (typeof PROPOSAL_EVENT_TYPES)[number];

// ---------------------------------------------------------------------------
// Row types
// ---------------------------------------------------------------------------

export type CrmProposal = {
  id: string;
  workspace_id: string;
  deal_id: string | null;
  crm_company_id: string | null;
  primary_contact_id: string | null;
  type: ProposalType;
  status: ProposalStatus;
  title: string;
  theme: ProposalTheme;
  content: ProposalContent;
  proposal_date: string | null;
  validity_days: number;
  prepared_by: string | null;
  subtotal_cents: number | null;
  recurring_monthly_cents: number | null;
  deposit_cents: number | null;
  sent_at: string | null;
  viewed_at: string | null;
  signed_at: string | null;
  declined_at: string | null;
  signer_name: string | null;
  signer_email: string | null;
  signer_ip: string | null;
  signature_typed: string | null;
  signer_consent: boolean | null;
  countersigner_name: string | null;
  countersigned_at: string | null;
  requires_dual_sign: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type CrmProposalLineItem = {
  id: string;
  workspace_id: string;
  proposal_id: string;
  kind: LineItemKind;
  label: string;
  description: string | null;
  badge: string | null;
  amount_cents: number;
  cadence: LineItemCadence;
  /** Null = evergreen (no end date). */
  recurring_months: number | null;
  /** Null = always included. Non-null = mutually-exclusive pick-one group. */
  option_group: string | null;
  is_optional: boolean;
  is_selected: boolean;
  position: number;
  created_at: string;
};

export type CrmProposalEvent = {
  id: string;
  workspace_id: string;
  proposal_id: string;
  type: ProposalEventType;
  actor: string | null;
  ip: string | null;
  user_agent: string | null;
  meta: Record<string, unknown>;
  occurred_at: string;
};

// ---------------------------------------------------------------------------
// Proposal document body — a typed discriminated-union block array
// (crm_proposals.content jsonb). Field `type` is the discriminant.
// ---------------------------------------------------------------------------

export type CoverBlock = {
  type: "cover";
  kicker: string;
  headline: string;
  intro: string;
  preparedFor: string;
  preparedBy: string;
  validityDate: string;
};

export type SituationBlock = {
  type: "situation";
  heading: string;
  body: string;
};

export type ScopeBlock = {
  type: "scope";
  heading: string;
  rows: { capability: string; whatYouGet: string }[];
};

export type NotIncludedBlock = {
  type: "not_included";
  heading: string;
  items: string[];
};

export type RecurringPlanBlock = {
  type: "recurring_plan";
  heading: string;
  planName: string;
  monthlyCents: number;
  cadenceNote: string;
  features: string[];
};

export type TimelineBlock = {
  type: "timeline";
  heading: string;
  totalDuration: string;
  phases: { label: string; duration: string; detail: string }[];
};

export type InvestmentBlock = {
  type: "investment";
  heading: string;
  note: string;
};

export type PaymentTermsBlock = {
  type: "payment_terms";
  heading: string;
  body: string;
};

export type TwoPathsBlock = {
  type: "two_paths";
  heading: string;
  managedLabel: string;
  managedBody: string;
  ownItLabel: string;
  ownItBody: string;
  months: number;
  managedMonthlyCents: number;
  ownItOneTimeCents: number;
};

export type TechStackBlock = {
  type: "tech_stack";
  heading: string;
  rows: { tool: string; purpose: string; costNote: string }[];
};

export type ThirdPartyCostsBlock = {
  type: "third_party_costs";
  heading: string;
  rows: { item: string; cadence: string; amountCents: number }[];
};

export type RoadmapBlock = {
  type: "roadmap";
  heading: string;
  phases: { label: string; body: string }[];
};

export type LiabilityBlock = {
  type: "liability";
  heading: string;
  responsible: string[];
  notResponsible: string[];
  liabilityCap: string;
  clientObligations: string[];
};

export type NextStepsBlock = {
  type: "next_steps";
  heading: string;
  steps: string[];
  approvalWindow: string;
};

export type AcceptanceBlock = {
  type: "acceptance";
  heading: string;
  body: string;
  dual: boolean;
};

export type CalloutBlock = {
  type: "callout";
  tone: "info" | "warn" | "trust";
  body: string;
};

export type ProposalBlock =
  | CoverBlock
  | SituationBlock
  | ScopeBlock
  | NotIncludedBlock
  | RecurringPlanBlock
  | TimelineBlock
  | InvestmentBlock
  | PaymentTermsBlock
  | TwoPathsBlock
  | TechStackBlock
  | ThirdPartyCostsBlock
  | RoadmapBlock
  | LiabilityBlock
  | NextStepsBlock
  | AcceptanceBlock
  | CalloutBlock;

export type ProposalContent = ProposalBlock[];
