// src/components/proposals/proposal-text.ts
//
// Pure text extraction for the proposal document (Task P3). Walks every
// ProposalBlock union member and returns its visible copy as plain text.
// Used by the test suite to get exhaustive block-type coverage at the type
// level: a missing `case` fails `tsc` via the `never` assertion below. The
// visual components are verified via `npm run build` instead of DOM
// rendering, since this repo has no jsdom/testing-library.

import { LINE_ITEM_CADENCE_LABEL, type ProposalBlock, type ProposalContent } from "@/types/proposals";
import { formatCents } from "@/lib/proposals/pricing";

function blockToPlainText(block: ProposalBlock): string {
  switch (block.type) {
    case "cover":
      return [block.kicker, block.headline, block.intro, block.preparedFor, block.preparedBy, block.validityDate].join(
        "\n"
      );
    case "situation":
      return [block.heading, block.body].join("\n");
    case "scope":
      return [block.heading, ...block.rows.map((r) => `${r.capability}: ${r.whatYouGet}`)].join("\n");
    case "not_included":
      return [block.heading, ...block.items].join("\n");
    case "recurring_plan":
      return [
        block.heading,
        block.planName,
        formatCents(block.monthlyCents),
        block.cadenceNote,
        ...block.features,
      ].join("\n");
    case "timeline":
      return [
        block.heading,
        block.totalDuration,
        ...block.phases.map((p) => `${p.label} (${p.duration}): ${p.detail}`),
      ].join("\n");
    case "investment":
      return [block.heading, block.note].join("\n");
    case "payment_terms":
      return [block.heading, block.body].join("\n");
    case "two_paths":
      return [
        block.heading,
        `${block.managedLabel}: ${block.managedBody}`,
        `${block.ownItLabel}: ${block.ownItBody}`,
        `${block.months} months`,
        formatCents(block.managedMonthlyCents),
        formatCents(block.ownItOneTimeCents),
      ].join("\n");
    case "tech_stack":
      return [block.heading, ...block.rows.map((r) => `${r.tool}: ${r.purpose} (${r.costNote})`)].join("\n");
    case "third_party_costs":
      return [
        block.heading,
        ...block.rows.map((r) => `${r.item} (${r.cadence}): ${formatCents(r.amountCents)}`),
      ].join("\n");
    case "roadmap":
      return [block.heading, ...block.phases.map((p) => `${p.label}: ${p.body}`)].join("\n");
    case "liability":
      return [
        block.heading,
        ...block.responsible,
        ...block.notResponsible,
        block.liabilityCap,
        ...block.clientObligations,
      ].join("\n");
    case "next_steps":
      return [block.heading, ...block.steps, block.approvalWindow].join("\n");
    case "acceptance":
      return [block.heading, block.body].join("\n");
    case "callout":
      return block.body;
    default: {
      // Exhaustiveness guard: if a new block type is added to the union
      // without a case above, this line fails `tsc --noEmit`.
      const _exhaustive: never = block;
      return _exhaustive;
    }
  }
}

/** Also inlines the cadence label for each investment line item's caption. */
export function cadenceLabel(cadence: keyof typeof LINE_ITEM_CADENCE_LABEL): string {
  return LINE_ITEM_CADENCE_LABEL[cadence].toUpperCase();
}

/** Walks every block in a proposal's content and returns its combined text. */
export function blocksToPlainText(content: ProposalContent): string {
  return content.map(blockToPlainText).join("\n\n");
}
