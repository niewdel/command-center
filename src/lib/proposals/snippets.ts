// src/lib/proposals/snippets.ts
//
// Tokenized Niewdel voice snippet library for the proposal builder (Task
// P4). Straight from docs/superpowers/research/2026-07-01-proposal-builder-blueprint.md
// ("Niewdel voice" + "Universal variables"). Pure data + one pure helper
// (`resolveSnippet`) so this can be unit tested without React. The builder
// UI's snippet inserter (Task P4) reads `PROPOSAL_SNIPPETS` and inserts the
// raw tokenized text into whichever field is focused; token substitution
// with real proposal values is intentionally left to the caller (the
// tokens read fine on their own as a starting point that Justin edits).
//
// NO em-dashes anywhere in this file, including this comment block.

export type ProposalSnippetCategory =
  | "grow_onto_it"
  | "scope_honesty"
  | "no_lock_in"
  | "forced_choice"
  | "direct_honesty"
  | "outcome_headline"
  | "reassurance"
  | "approval_window"
  | "liability"
  | "footer";

export type ProposalSnippet = {
  id: string;
  category: ProposalSnippetCategory;
  /** Tokenized text, e.g. "{{client}}" placeholders left intact. */
  text: string;
};

export const PROPOSAL_SNIPPET_CATEGORY_LABEL: Record<ProposalSnippetCategory, string> = {
  grow_onto_it: "Grow onto it",
  scope_honesty: "Scope honesty",
  no_lock_in: "No lock-in",
  forced_choice: "Forced choice at signature",
  direct_honesty: "Direct honesty",
  outcome_headline: "Outcome headline",
  reassurance: "Reassurance",
  approval_window: "Approval window",
  liability: "Liability structure",
  footer: "Footer",
};

/**
 * Every token this library uses, for reference and for the substitution
 * helper below. Matches the blueprint's "Universal variables" list.
 */
export const PROPOSAL_SNIPPET_TOKENS = [
  "{{client}}",
  "{{client_name}}",
  "{{contact}}",
  "{{city_state}}",
  "{{proposal_date}}",
  "{{validity_date}}",
  "{{kickoff_date}}",
  "{{kickoff_by_date}}",
] as const;
export type ProposalSnippetToken = (typeof PROPOSAL_SNIPPET_TOKENS)[number];

export const PROPOSAL_SNIPPETS: ProposalSnippet[] = [
  {
    id: "grow-onto-it-1",
    category: "grow_onto_it",
    text: "Start simple. Built to grow.",
  },
  {
    id: "grow-onto-it-2",
    category: "grow_onto_it",
    text: "You pay to add, never to redo.",
  },
  {
    id: "scope-honesty-1",
    category: "scope_honesty",
    text: "Not included (intentionally).",
  },
  {
    id: "no-lock-in-1",
    category: "no_lock_in",
    text: "No proprietary lock-in, no Niewdel dependencies after the swap.",
  },
  {
    id: "no-lock-in-2",
    category: "no_lock_in",
    text: "Your data, already yours.",
  },
  {
    id: "forced-choice-1",
    category: "forced_choice",
    text: "Managed by us, or owned by you. Pick one.",
  },
  {
    id: "direct-honesty-1",
    category: "direct_honesty",
    text: "It is a tool, not an agent. That distinction matters and I want to address it directly.",
  },
  {
    id: "outcome-headline-1",
    category: "outcome_headline",
    text: "A site that wins the GC's vetting call.",
  },
  {
    id: "outcome-headline-2",
    category: "outcome_headline",
    text: "Replace the assistant. Reclaim the desk.",
  },
  {
    id: "outcome-headline-3",
    category: "outcome_headline",
    text: "The right leads. The right conversation.",
  },
  {
    id: "reassurance-1",
    category: "reassurance",
    text: "On call for the first 48 hours after launch.",
  },
  {
    id: "approval-window-1",
    category: "approval_window",
    text: "Pricing held for 30 days from proposal date.",
  },
  {
    id: "liability-1",
    category: "liability",
    text: "Liability cap: greater of total fees paid or the build deposit.",
  },
  {
    id: "liability-2",
    category: "liability",
    text: "Notify Niewdel within 24 hours of any suspected compromise.",
  },
  {
    id: "footer-1",
    category: "footer",
    text: "Niewdel · AI Automation · Fort Mill, SC",
  },
  {
    id: "kickoff-1",
    category: "grow_onto_it",
    text: "Kickoff call scheduled within 48 hours of signature, targeting {{kickoff_date}} for {{client_name}}.",
  },
];

/** Group snippets by category, in display order, for a tabbed/sectioned inserter UI. */
export function snippetsByCategory(): { category: ProposalSnippetCategory; label: string; snippets: ProposalSnippet[] }[] {
  const order: ProposalSnippetCategory[] = [
    "outcome_headline",
    "grow_onto_it",
    "scope_honesty",
    "no_lock_in",
    "forced_choice",
    "direct_honesty",
    "reassurance",
    "approval_window",
    "liability",
    "footer",
  ];
  return order.map((category) => ({
    category,
    label: PROPOSAL_SNIPPET_CATEGORY_LABEL[category],
    snippets: PROPOSAL_SNIPPETS.filter((s) => s.category === category),
  }));
}

/**
 * Append a snippet's raw tokenized text onto an existing field value. Adds a
 * single separating space when the existing value doesn't already end in
 * whitespace, so repeated inserts don't run words together.
 */
export function insertSnippetInto(current: string, snippetText: string): string {
  if (!current) return snippetText;
  const needsSpace = !/\s$/.test(current);
  return `${current}${needsSpace ? " " : ""}${snippetText}`;
}
