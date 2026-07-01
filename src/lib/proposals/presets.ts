// src/lib/proposals/presets.ts
//
// Per-type default content for the proposal builder (Task P2). Seeds a
// starter block array + starter line items + dual-sign flag for each
// ProposalType, per the block/pricing table in
// docs/superpowers/research/2026-07-01-proposal-builder-blueprint.md.
//
// Copy is Niewdel voice: outcome-first, no em-dashes, no AI slop. Every
// string here is a starting point the builder UI lets Justin edit before
// sending, not final client copy.

import type { CrmProposalLineItem, ProposalContent, ProposalType } from "@/types/proposals";

export type LineItemPreset = Omit<
  CrmProposalLineItem,
  "id" | "workspace_id" | "proposal_id" | "created_at"
>;

export type ProposalPreset = {
  blocks: ProposalContent;
  lineItems: LineItemPreset[];
  requiresDualSign: boolean;
};

const FOOTER_NOTE = "Niewdel · AI Automation · Fort Mill, SC";

function coverBlock(kicker: string, headline: string, intro: string): ProposalContent[number] {
  return {
    type: "cover",
    kicker,
    headline,
    intro,
    preparedFor: "{{client_name}}",
    preparedBy: "Justin Ledwein, Niewdel",
    validityDate: "{{validity_date}}",
  };
}

function nextSteps(): ProposalContent[number] {
  return {
    type: "next_steps",
    heading: "Next steps",
    steps: [
      "Review the scope and investment below.",
      "Reply with any questions, no obligation.",
      "Sign to lock in the start date.",
      "Kickoff call scheduled within 48 hours of signature.",
    ],
    approvalWindow: "Pricing held for 30 days from proposal date.",
  };
}

function paymentTerms(body: string): ProposalContent[number] {
  return { type: "payment_terms", heading: "Payment terms", body };
}

function liabilityBlock(): ProposalContent[number] {
  return {
    type: "liability",
    heading: "Liability and security",
    responsible: [
      "Niewdel is responsible for the work described in the scope above.",
      "Niewdel will notify the client within 24 hours of any suspected compromise.",
    ],
    notResponsible: [
      "Niewdel is not responsible for outcomes outside the agreed scope.",
      "Niewdel is not responsible for third-party platform outages or policy changes.",
    ],
    liabilityCap: "Liability cap: greater of total fees paid or the build deposit.",
    clientObligations: [
      "Provide timely access to accounts, content, and approvals.",
      "Notify Niewdel within 24 hours of any suspected compromise.",
    ],
  };
}

function acceptance(dual: boolean): ProposalContent[number] {
  return {
    type: "acceptance",
    heading: "Acceptance",
    body: dual
      ? "By signing below, both parties agree to the scope, terms, and investment outlined in this agreement."
      : "By signing below, you agree to the scope, terms, and investment outlined in this proposal.",
    dual,
  };
}

function investmentBlock(note: string): ProposalContent[number] {
  return { type: "investment", heading: "Investment", note };
}

// ---------------------------------------------------------------------------
// website_build
// ---------------------------------------------------------------------------

function websiteBuildPreset(): ProposalPreset {
  const blocks: ProposalContent = [
    coverBlock(
      "WEBSITE BUILD",
      "A site that wins the GC's vetting call.",
      "This proposal covers a custom-built website designed to convert the visitors you already have, built to grow rather than be rebuilt in a year."
    ),
    {
      type: "situation",
      heading: "The situation",
      body: "The current site is not doing the one job it needs to do: turning visitors into booked calls. This proposal replaces it with a site built around that outcome.",
    },
    {
      type: "scope",
      heading: "Scope",
      rows: [
        { capability: "Custom design", whatYouGet: "A site built for your business, not a template" },
        { capability: "Copywriting", whatYouGet: "Outcome-first copy on every page" },
        { capability: "Mobile + speed", whatYouGet: "Fast, responsive on every device" },
        { capability: "Lead capture", whatYouGet: "Forms and CTAs wired to your CRM" },
      ],
    },
    {
      type: "not_included",
      heading: "Not included (intentionally)",
      items: [
        "Paid ad management",
        "Ongoing content writing beyond launch pages",
        "Third-party software subscriptions",
      ],
    },
    {
      type: "recurring_plan",
      heading: "Managed care plan",
      planName: "Managed Care",
      monthlyCents: 25000,
      cadenceNote: "Billed monthly, cancel with 30 days notice.",
      features: ["Hosting and uptime monitoring", "Security patching", "Monthly content updates", "Priority support"],
    },
    {
      type: "timeline",
      heading: "Timeline",
      totalDuration: "4 to 6 weeks",
      phases: [
        { label: "Discovery", duration: "Week 1", detail: "Content audit and sitemap" },
        { label: "Design", duration: "Weeks 2 to 3", detail: "Full-site design pass" },
        { label: "Build", duration: "Weeks 3 to 5", detail: "Development and content load" },
        { label: "Launch", duration: "Week 6", detail: "QA, launch, 48-hour support window" },
      ],
    },
    investmentBlock("Start simple. Built to grow. You pay to add, never to redo."),
    paymentTerms("50% due at signature, 50% due at launch. ACH preferred."),
    {
      type: "two_paths",
      heading: "Managed by us, or owned by you. Pick one.",
      managedLabel: "Managed",
      managedBody: "We host, update, and maintain the site for you every month.",
      ownItLabel: "Own it",
      ownItBody: "One-time handoff fee, no proprietary lock-in, no Niewdel dependencies after the swap. Your data, already yours.",
      months: 12,
      managedMonthlyCents: 25000,
      ownItOneTimeCents: 149900,
    },
    {
      type: "roadmap",
      heading: "The bigger roadmap",
      phases: [
        { label: "Phase 2", body: "SEO content expansion once the site is live and converting." },
        { label: "Phase 3", body: "Automation to route and qualify leads before they hit your inbox." },
      ],
    },
    liabilityBlock(),
    nextSteps(),
    acceptance(false),
  ];

  const lineItems: LineItemPreset[] = [
    {
      kind: "one_time",
      label: "Website Build",
      description: "Custom design, copy, and development for the full site.",
      badge: null,
      amount_cents: 600000,
      cadence: "one_time",
      recurring_months: null,
      option_group: null,
      is_optional: false,
      is_selected: true,
      position: 0,
    },
    {
      kind: "recurring",
      label: "Managed Care Plan",
      description: "Hosting, updates, and monitoring, billed monthly.",
      badge: "Recommended",
      amount_cents: 25000,
      cadence: "per_month",
      recurring_months: null,
      option_group: "ownership_path",
      is_optional: false,
      is_selected: true,
      position: 1,
    },
    {
      kind: "handoff",
      label: "Full Ownership Handoff",
      description: "Own the site outright. No monthly fee, no lock-in.",
      badge: null,
      amount_cents: 149900,
      cadence: "at_handoff",
      recurring_months: null,
      option_group: "ownership_path",
      is_optional: false,
      is_selected: false,
      position: 2,
    },
  ];

  return { blocks, lineItems, requiresDualSign: false };
}

// ---------------------------------------------------------------------------
// retainer (Managed Services Agreement, dual-sign)
// ---------------------------------------------------------------------------

function retainerPreset(): ProposalPreset {
  const blocks: ProposalContent = [
    coverBlock(
      "RETAINER · MANAGED SERVICES AGREEMENT",
      "Replace the assistant. Reclaim the desk.",
      "This agreement covers ongoing managed services delivered on a monthly retainer, structured so both parties know exactly what is owed and when."
    ),
    {
      type: "situation",
      heading: "The situation",
      body: "Day-to-day operations need consistent, dependable coverage that does not depend on hiring, training, or managing another employee.",
    },
    {
      type: "scope",
      heading: "Service tiers",
      rows: [
        { capability: "Core tier", whatYouGet: "Daily monitoring, standard turnaround, monthly report" },
        { capability: "Priority tier", whatYouGet: "Same-day turnaround, direct line, quarterly strategy review" },
      ],
    },
    {
      type: "recurring_plan",
      heading: "Retainer plan",
      planName: "Managed Services",
      monthlyCents: 350000,
      cadenceNote: "Billed monthly, evergreen. Cancel with 30 days written notice.",
      features: ["Dedicated monthly hours", "Priority response times", "Monthly reporting", "Quarterly strategy review"],
    },
    {
      type: "callout",
      tone: "trust",
      body: "No proprietary lock-in, no Niewdel dependencies after the term ends. Your data, already yours.",
    },
    {
      type: "timeline",
      heading: "Term",
      totalDuration: "Month-to-month, evergreen",
      phases: [
        { label: "Onboarding", duration: "Week 1", detail: "Access, systems handoff, kickoff call" },
        { label: "Ongoing service", duration: "Monthly", detail: "Recurring scope delivered per the tier above" },
      ],
    },
    investmentBlock("Start simple. Built to grow. You pay to add, never to redo."),
    paymentTerms("Monthly retainer billed in advance on the 1st. ACH preferred. Onboarding fee due at signature."),
    liabilityBlock(),
    nextSteps(),
    acceptance(true),
  ];

  const lineItems: LineItemPreset[] = [
    {
      kind: "one_time",
      label: "Onboarding",
      description: "Systems access, handoff, and kickoff.",
      badge: null,
      amount_cents: 150000,
      cadence: "upfront",
      recurring_months: null,
      option_group: null,
      is_optional: false,
      is_selected: true,
      position: 0,
    },
    {
      kind: "recurring",
      label: "Managed Services Retainer",
      description: "Ongoing monthly service per the Core tier.",
      badge: null,
      amount_cents: 350000,
      cadence: "per_month",
      recurring_months: null,
      option_group: null,
      is_optional: false,
      is_selected: true,
      position: 1,
    },
  ];

  return { blocks, lineItems, requiresDualSign: true };
}

// ---------------------------------------------------------------------------
// lead_gen (tool / lead-gen)
// ---------------------------------------------------------------------------

function leadGenPreset(): ProposalPreset {
  const blocks: ProposalContent = [
    coverBlock(
      "LEAD GEN · TOOL",
      "The right leads. The right conversation.",
      "This proposal covers a purpose-built lead generation tool, plus a short window of managed support to get it converting before it is fully handed off."
    ),
    {
      type: "situation",
      heading: "The situation",
      body: "Inbound volume is inconsistent and the leads that do arrive are not always the right fit. This closes that gap with a tool tuned to your ICP.",
    },
    {
      type: "situation",
      heading: "What I heard you need",
      body: "A repeatable way to surface qualified leads without adding headcount, with visibility into what is working.",
    },
    {
      type: "callout",
      tone: "info",
      body: "It is a tool, not an agent. That distinction matters and I want to address it directly.",
    },
    {
      type: "not_included",
      heading: "Not included (intentionally)",
      items: ["Paid ad spend", "Outbound list purchasing", "CRM replacement"],
    },
    {
      type: "tech_stack",
      heading: "Tech stack",
      rows: [
        { tool: "Enrichment API", purpose: "Contact and firmographic data", costNote: "Billed monthly, pass-through" },
        { tool: "CRM integration", purpose: "Sync qualified leads automatically", costNote: "No additional cost" },
      ],
    },
    {
      type: "third_party_costs",
      heading: "Third-party costs",
      rows: [{ item: "Enrichment API usage", cadence: "Monthly", amountCents: 15000 }],
    },
    {
      type: "timeline",
      heading: "Timeline",
      totalDuration: "3 to 4 weeks to launch",
      phases: [
        { label: "Build", duration: "Weeks 1 to 3", detail: "Tool build and integration" },
        { label: "Launch + tune", duration: "Week 4", detail: "Launch and first-pass tuning" },
      ],
    },
    investmentBlock("Start simple. Built to grow. You pay to add, never to redo."),
    paymentTerms("50% due at signature, 50% due at launch. Managed months billed monthly. ACH preferred."),
    {
      type: "callout",
      tone: "info",
      body: "After month 6, the managed retainer ends and the handoff package below takes over. No surprise renewals.",
    },
    {
      type: "roadmap",
      heading: "The bigger roadmap",
      phases: [{ label: "Phase 2", body: "Expand targeting once the tool has a full quarter of signal to learn from." }],
    },
    nextSteps(),
    acceptance(false),
  ];

  const lineItems: LineItemPreset[] = [
    {
      kind: "one_time",
      label: "Tool Build",
      description: "Custom lead generation tool, built and integrated with your CRM.",
      badge: null,
      amount_cents: 450000,
      cadence: "one_time",
      recurring_months: null,
      option_group: null,
      is_optional: false,
      is_selected: true,
      position: 0,
    },
    {
      kind: "recurring",
      label: "Managed Onboarding",
      description: "Six months of managed tuning and support.",
      badge: null,
      amount_cents: 75000,
      cadence: "per_month",
      recurring_months: 6,
      option_group: null,
      is_optional: false,
      is_selected: true,
      position: 1,
    },
    {
      kind: "handoff",
      label: "Handoff Package",
      description: "Full documentation and ownership transfer after month 6.",
      badge: null,
      amount_cents: 199900,
      cadence: "at_handoff",
      recurring_months: null,
      option_group: null,
      is_optional: true,
      is_selected: false,
      position: 2,
    },
  ];

  return { blocks, lineItems, requiresDualSign: false };
}

// ---------------------------------------------------------------------------
// ai_phased (AI / automation phased rollout)
// ---------------------------------------------------------------------------

function aiPhasedPreset(): ProposalPreset {
  const blocks: ProposalContent = [
    coverBlock(
      "AI / AUTOMATION · PHASED ROLLOUT",
      "Replace the assistant. Reclaim the desk.",
      "This proposal covers a phased rollout of automation built to take repetitive work off your desk, with clear ownership of what you own at each handoff."
    ),
    {
      type: "situation",
      heading: "The situation",
      body: "Manual, repetitive work is eating hours that should go to higher-value work. This proposal automates it in phases, so value shows up early and often.",
    },
    {
      type: "scope",
      heading: "Phased scope",
      rows: [
        { capability: "Phase 1", whatYouGet: "Automate the single highest-friction workflow" },
        { capability: "Phase 2", whatYouGet: "Extend automation to adjacent workflows" },
        { capability: "Phase 3", whatYouGet: "Full ownership transfer and documentation" },
      ],
    },
    {
      type: "third_party_costs",
      heading: "Third-party API costs",
      rows: [{ item: "LLM API usage", cadence: "Monthly", amountCents: 20000 }],
    },
    {
      type: "two_paths",
      heading: "Managed by us, or owned by you. Pick one.",
      managedLabel: "Managed",
      managedBody: "We run and tune the automation for you every month.",
      ownItLabel: "Own it",
      ownItBody: "Full ownership transfer with documentation, no proprietary lock-in, no Niewdel dependencies after the swap.",
      months: 6,
      managedMonthlyCents: 95000,
      ownItOneTimeCents: 249900,
    },
    {
      type: "roadmap",
      heading: "The bigger roadmap",
      phases: [{ label: "Phase 4", body: "Add additional automated roles as volume grows." }],
    },
    {
      type: "timeline",
      heading: "Timeline",
      totalDuration: "8 to 10 weeks across all phases",
      phases: [
        { label: "Phase 1 build", duration: "Weeks 1 to 4", detail: "Highest-friction workflow automated" },
        { label: "Phase 2 build", duration: "Weeks 5 to 8", detail: "Adjacent workflows automated" },
        { label: "Handoff", duration: "Weeks 9 to 10", detail: "Documentation and ownership transfer" },
      ],
    },
    investmentBlock("Start simple. Built to grow. You pay to add, never to redo."),
    paymentTerms("50% due at signature per phase, 50% due at each phase launch. ACH preferred."),
    liabilityBlock(),
    nextSteps(),
    acceptance(false),
  ];

  const lineItems: LineItemPreset[] = [
    {
      kind: "one_time",
      label: "Phase 1 Build",
      description: "Automate the highest-friction workflow.",
      badge: null,
      amount_cents: 500000,
      cadence: "one_time",
      recurring_months: null,
      option_group: null,
      is_optional: false,
      is_selected: true,
      position: 0,
    },
    {
      kind: "one_time",
      label: "Phase 2 Build",
      description: "Extend automation to adjacent workflows.",
      badge: null,
      amount_cents: 350000,
      cadence: "one_time",
      recurring_months: null,
      option_group: null,
      is_optional: false,
      is_selected: true,
      position: 1,
    },
    {
      kind: "recurring",
      label: "Managed Onboarding",
      description: "Six months of managed tuning and support.",
      badge: null,
      amount_cents: 95000,
      cadence: "per_month",
      recurring_months: 6,
      option_group: "path",
      is_optional: false,
      is_selected: true,
      position: 2,
    },
    {
      kind: "handoff",
      label: "Ownership Transfer",
      description: "Full documentation and ownership transfer, no ongoing fee.",
      badge: null,
      amount_cents: 249900,
      cadence: "at_handoff",
      recurring_months: null,
      option_group: "path",
      is_optional: false,
      is_selected: false,
      position: 3,
    },
  ];

  return { blocks, lineItems, requiresDualSign: false };
}

// ---------------------------------------------------------------------------
// custom (minimal)
// ---------------------------------------------------------------------------

function customPreset(): ProposalPreset {
  const blocks: ProposalContent = [
    coverBlock("CUSTOM PROPOSAL", "Built for exactly what you need.", "This proposal covers a custom scope of work, priced and timed to the outcome you are after."),
    {
      type: "scope",
      heading: "Scope",
      rows: [{ capability: "Scope item", whatYouGet: "What the client gets" }],
    },
    investmentBlock("Start simple. Built to grow. You pay to add, never to redo."),
    paymentTerms("50% due at signature, 50% due at completion. ACH preferred."),
    nextSteps(),
    acceptance(false),
  ];

  const lineItems: LineItemPreset[] = [
    {
      kind: "one_time",
      label: "Project Fee",
      description: "Custom scope of work.",
      badge: null,
      amount_cents: 0,
      cadence: "one_time",
      recurring_months: null,
      option_group: null,
      is_optional: false,
      is_selected: true,
      position: 0,
    },
  ];

  return { blocks, lineItems, requiresDualSign: false };
}

export function presetFor(type: ProposalType): ProposalPreset {
  switch (type) {
    case "website_build":
      return websiteBuildPreset();
    case "retainer":
      return retainerPreset();
    case "lead_gen":
      return leadGenPreset();
    case "ai_phased":
      return aiPhasedPreset();
    case "custom":
      return customPreset();
  }
}

// Referenced by callers that want to stamp the footer note consistently.
export const PROPOSAL_FOOTER_NOTE = FOOTER_NOTE;
