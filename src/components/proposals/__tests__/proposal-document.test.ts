import { describe, expect, it } from "vitest";
import { blocksToPlainText } from "../proposal-document";
import { presetFor } from "@/lib/proposals/presets";
import { PROPOSAL_TYPES } from "@/types/proposals";
import type { ProposalBlock, ProposalContent } from "@/types/proposals";

describe("blocksToPlainText", () => {
  it.each(PROPOSAL_TYPES)("handles every block in the %s preset without throwing", (type) => {
    const preset = presetFor(type);
    expect(() => blocksToPlainText(preset.blocks)).not.toThrow();
    const text = blocksToPlainText(preset.blocks);
    expect(text.length).toBeGreaterThan(0);
  });

  it("website_build preset produces expected key strings", () => {
    const text = blocksToPlainText(presetFor("website_build").blocks);
    expect(text).toContain("A site that wins the GC's vetting call.");
    expect(text).toContain("Managed by us, or owned by you. Pick one.");
    expect(text).toContain("Start simple. Built to grow. You pay to add, never to redo.");
  });

  it("retainer preset marks the acceptance block as dual-sign copy", () => {
    const text = blocksToPlainText(presetFor("retainer").blocks);
    expect(text).toContain("both parties agree");
  });

  // One block of every union member, so a missing case in blockToPlainText's
  // switch fails at the `never` assertion (tsc) rather than silently
  // dropping copy at runtime.
  const oneOfEach: ProposalContent = [
    { type: "cover", kicker: "K", headline: "H", intro: "I", preparedFor: "PF", preparedBy: "PB", validityDate: "VD" },
    { type: "situation", heading: "Sit", body: "Body" },
    { type: "scope", heading: "Scope", rows: [{ capability: "C", whatYouGet: "W" }] },
    { type: "not_included", heading: "Not included", items: ["X"] },
    {
      type: "recurring_plan",
      heading: "Plan",
      planName: "Plan Name",
      monthlyCents: 12345,
      cadenceNote: "note",
      features: ["Feature"],
    },
    {
      type: "timeline",
      heading: "Timeline",
      totalDuration: "4 weeks",
      phases: [{ label: "Phase", duration: "Week 1", detail: "Detail" }],
    },
    { type: "investment", heading: "Investment", note: "Note" },
    { type: "payment_terms", heading: "Terms", body: "Body" },
    {
      type: "two_paths",
      heading: "Two paths",
      managedLabel: "Managed",
      managedBody: "Managed body",
      ownItLabel: "Own it",
      ownItBody: "Own it body",
      months: 12,
      managedMonthlyCents: 25000,
      ownItOneTimeCents: 149900,
    },
    { type: "tech_stack", heading: "Stack", rows: [{ tool: "Tool", purpose: "Purpose", costNote: "Cost" }] },
    {
      type: "third_party_costs",
      heading: "Costs",
      rows: [{ item: "Item", cadence: "Monthly", amountCents: 1500 }],
    },
    { type: "roadmap", heading: "Roadmap", phases: [{ label: "Phase", body: "Body" }] },
    {
      type: "liability",
      heading: "Liability",
      responsible: ["R"],
      notResponsible: ["NR"],
      liabilityCap: "Cap",
      clientObligations: ["Obligation"],
    },
    { type: "next_steps", heading: "Next steps", steps: ["Step"], approvalWindow: "30 days" },
    { type: "acceptance", heading: "Acceptance", body: "Body", dual: false },
    { type: "callout", tone: "info", body: "Callout body" },
  ];

  it("handles one instance of every ProposalBlock union member", () => {
    expect(() => blocksToPlainText(oneOfEach)).not.toThrow();
    const text = blocksToPlainText(oneOfEach);
    for (const block of oneOfEach) {
      const expectedSnippet = snippetFor(block);
      expect(text).toContain(expectedSnippet);
    }
  });
});

function snippetFor(block: ProposalBlock): string {
  switch (block.type) {
    case "cover":
      return block.headline;
    case "situation":
      return block.body;
    case "scope":
      return block.rows[0].capability;
    case "not_included":
      return block.items[0];
    case "recurring_plan":
      return block.planName;
    case "timeline":
      return block.phases[0].label;
    case "investment":
      return block.note;
    case "payment_terms":
      return block.body;
    case "two_paths":
      return block.managedLabel;
    case "tech_stack":
      return block.rows[0].tool;
    case "third_party_costs":
      return block.rows[0].item;
    case "roadmap":
      return block.phases[0].label;
    case "liability":
      return block.liabilityCap;
    case "next_steps":
      return block.steps[0];
    case "acceptance":
      return block.body;
    case "callout":
      return block.body;
  }
}
