// src/components/proposals/proposal-document.tsx
//
// Pure presentational renderer for a proposal's content blocks (Task P3).
// No data fetching, no client hooks (the interactive acceptance panel is
// Task P5. Here `acceptance` renders as static terms + a signature
// placeholder). Maps `content: ProposalContent` to block components in
// order, resolves + injects line items into the `investment` block via the
// P1 pricing engine, and applies the brand-v3 theme.

import type { CSSProperties } from "react";
import type { CrmProposal, CrmProposalLineItem, ProposalContent, ProposalTheme } from "@/types/proposals";
import { PROPOSAL_FOOTER_NOTE } from "@/lib/proposals/presets";
import { CoverBlockView } from "./blocks/cover-block";
import { SituationBlockView } from "./blocks/situation-block";
import { ScopeBlockView } from "./blocks/scope-block";
import { NotIncludedBlockView } from "./blocks/not-included-block";
import { RecurringPlanBlockView } from "./blocks/recurring-plan-block";
import { TimelineBlockView } from "./blocks/timeline-block";
import { InvestmentBlockView } from "./blocks/investment-block";
import { PaymentTermsBlockView } from "./blocks/payment-terms-block";
import { TwoPathsBlockView } from "./blocks/two-paths-block";
import { TechStackBlockView } from "./blocks/tech-stack-block";
import { ThirdPartyCostsBlockView } from "./blocks/third-party-costs-block";
import { RoadmapBlockView } from "./blocks/roadmap-block";
import { LiabilityBlockView } from "./blocks/liability-block";
import { NextStepsBlockView } from "./blocks/next-steps-block";
import { AcceptanceBlockView } from "./blocks/acceptance-block";
import { CalloutBlockView } from "./blocks/callout-block";

export { blocksToPlainText } from "./proposal-text";

interface ProposalDocumentProps {
  proposal: Pick<CrmProposal, "title" | "status">;
  content: ProposalContent;
  lineItems: CrmProposalLineItem[];
  theme: ProposalTheme;
  mode: "preview" | "client";
}

/**
 * Light theme CSS var overrides, scoped to the document wrapper only (the
 * rest of the app stays dark-first per brand v3). Dark theme uses the
 * app's existing root tokens unchanged and reads as an "Agreement"; light
 * theme swaps to the brand's light-surface tokens and reads as a
 * "Proposal".
 */
const LIGHT_THEME_STYLE = {
  ["--background" as string]: "#F4F6F8",
  ["--foreground" as string]: "#14181B",
  ["--card" as string]: "#FFFFFF",
  ["--card-foreground" as string]: "#14181B",
  ["--border" as string]: "#E2E6E9",
  ["--muted-foreground" as string]: "#5C666D",
  ["--rust" as string]: "#1B4D8F",
} as CSSProperties;

function renderBlock(block: ProposalContent[number], key: number, lineItems: CrmProposalLineItem[]) {
  switch (block.type) {
    case "cover":
      return <CoverBlockView key={key} block={block} />;
    case "situation":
      return <SituationBlockView key={key} block={block} />;
    case "scope":
      return <ScopeBlockView key={key} block={block} />;
    case "not_included":
      return <NotIncludedBlockView key={key} block={block} />;
    case "recurring_plan":
      return <RecurringPlanBlockView key={key} block={block} />;
    case "timeline":
      return <TimelineBlockView key={key} block={block} />;
    case "investment":
      return <InvestmentBlockView key={key} block={block} lineItems={lineItems} />;
    case "payment_terms":
      return <PaymentTermsBlockView key={key} block={block} />;
    case "two_paths":
      return <TwoPathsBlockView key={key} block={block} />;
    case "tech_stack":
      return <TechStackBlockView key={key} block={block} />;
    case "third_party_costs":
      return <ThirdPartyCostsBlockView key={key} block={block} />;
    case "roadmap":
      return <RoadmapBlockView key={key} block={block} />;
    case "liability":
      return <LiabilityBlockView key={key} block={block} />;
    case "next_steps":
      return <NextStepsBlockView key={key} block={block} />;
    case "acceptance":
      return <AcceptanceBlockView key={key} block={block} />;
    case "callout":
      return <CalloutBlockView key={key} block={block} />;
    default: {
      // Exhaustiveness guard: a new block type without a case fails tsc.
      const _exhaustive: never = block;
      return _exhaustive;
    }
  }
}

export function ProposalDocument({ proposal, content, lineItems, theme, mode }: ProposalDocumentProps) {
  const style = theme === "light" ? LIGHT_THEME_STYLE : undefined;
  const feel = theme === "dark" ? "Agreement" : "Proposal";

  return (
    <div
      className="proposal-document bg-background text-foreground rounded-[12px]"
      data-theme={theme}
      data-mode={mode}
      style={style}
    >
      <div className="mb-6 flex items-center justify-between gap-3">
        <span className="report-label">{feel}</span>
        {mode === "preview" && <span className="report-label text-[var(--rust)]">Preview</span>}
      </div>
      {content.map((block, i) => renderBlock(block, i, lineItems))}
      <footer className="mt-10 border-t border-border pt-6 text-xs text-muted-foreground">
        {PROPOSAL_FOOTER_NOTE}
        <span className="ml-2 text-muted-foreground/70">{proposal.title}</span>
      </footer>
    </div>
  );
}
