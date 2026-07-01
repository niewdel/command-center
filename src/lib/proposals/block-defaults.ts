// src/lib/proposals/block-defaults.ts
//
// Block-type metadata + blank defaults for the builder's "add block" menu
// (Task P4). Pure data, no React.

import type { ProposalBlock } from "@/types/proposals";

export const BLOCK_TYPES = [
  "cover",
  "situation",
  "scope",
  "not_included",
  "recurring_plan",
  "timeline",
  "investment",
  "payment_terms",
  "two_paths",
  "tech_stack",
  "third_party_costs",
  "roadmap",
  "liability",
  "next_steps",
  "acceptance",
  "callout",
] as const satisfies readonly ProposalBlock["type"][];

export const BLOCK_TYPE_LABEL: Record<ProposalBlock["type"], string> = {
  cover: "Cover",
  situation: "Situation / narrative",
  scope: "Scope table",
  not_included: "Not included",
  recurring_plan: "Recurring plan card",
  timeline: "Timeline",
  investment: "Investment",
  payment_terms: "Payment terms",
  two_paths: "Two paths comparison",
  tech_stack: "Tech stack table",
  third_party_costs: "Third-party costs table",
  roadmap: "Bigger roadmap",
  liability: "Liability and security",
  next_steps: "Next steps",
  acceptance: "Acceptance / e-sign",
  callout: "Callout",
};

/** A blank starting value for a newly added block of the given type. */
export function defaultBlockFor(type: ProposalBlock["type"]): ProposalBlock {
  switch (type) {
    case "cover":
      return {
        type: "cover",
        kicker: "PROPOSAL",
        headline: "",
        intro: "",
        preparedFor: "{{client_name}}",
        preparedBy: "Justin Ledwein, Niewdel",
        validityDate: "{{validity_date}}",
      };
    case "situation":
      return { type: "situation", heading: "The situation", body: "" };
    case "scope":
      return { type: "scope", heading: "Scope", rows: [] };
    case "not_included":
      return { type: "not_included", heading: "Not included (intentionally)", items: [] };
    case "recurring_plan":
      return {
        type: "recurring_plan",
        heading: "Recurring plan",
        planName: "",
        monthlyCents: 0,
        cadenceNote: "Billed monthly, cancel with 30 days notice.",
        features: [],
      };
    case "timeline":
      return { type: "timeline", heading: "Timeline", totalDuration: "", phases: [] };
    case "investment":
      return { type: "investment", heading: "Investment", note: "" };
    case "payment_terms":
      return { type: "payment_terms", heading: "Payment terms", body: "50% due at signature, 50% due at launch. ACH preferred." };
    case "two_paths":
      return {
        type: "two_paths",
        heading: "Managed by us, or owned by you. Pick one.",
        managedLabel: "Managed",
        managedBody: "",
        ownItLabel: "Own it",
        ownItBody: "",
        months: 12,
        managedMonthlyCents: 0,
        ownItOneTimeCents: 0,
      };
    case "tech_stack":
      return { type: "tech_stack", heading: "Tech stack", rows: [] };
    case "third_party_costs":
      return { type: "third_party_costs", heading: "Third-party costs", rows: [] };
    case "roadmap":
      return { type: "roadmap", heading: "The bigger roadmap", phases: [] };
    case "liability":
      return {
        type: "liability",
        heading: "Liability and security",
        responsible: [],
        notResponsible: [],
        liabilityCap: "Liability cap: greater of total fees paid or the build deposit.",
        clientObligations: [],
      };
    case "next_steps":
      return { type: "next_steps", heading: "Next steps", steps: [], approvalWindow: "Pricing held for 30 days from proposal date." };
    case "acceptance":
      return {
        type: "acceptance",
        heading: "Acceptance",
        body: "By signing below, you agree to the scope, terms, and investment outlined in this proposal.",
        dual: false,
      };
    case "callout":
      return { type: "callout", tone: "info", body: "" };
  }
}
