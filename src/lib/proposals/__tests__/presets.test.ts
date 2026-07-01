import { describe, it, expect } from "vitest";
import { presetFor } from "../presets";
import { PROPOSAL_TYPES, LINE_ITEM_KINDS, LINE_ITEM_CADENCES } from "@/types/proposals";

function allText(preset: ReturnType<typeof presetFor>): string {
  const blockText = JSON.stringify(preset.blocks);
  const lineItemText = JSON.stringify(preset.lineItems);
  return `${blockText}\n${lineItemText}`;
}

describe("presetFor", () => {
  it.each(PROPOSAL_TYPES)("returns non-empty blocks and line items for %s", (type) => {
    const preset = presetFor(type);
    expect(preset.blocks.length).toBeGreaterThan(0);
    expect(preset.lineItems.length).toBeGreaterThan(0);
  });

  it("marks retainer as requiring dual sign", () => {
    const preset = presetFor("retainer");
    expect(preset.requiresDualSign).toBe(true);
  });

  it("does not require dual sign for other types", () => {
    for (const type of PROPOSAL_TYPES.filter((t) => t !== "retainer")) {
      expect(presetFor(type).requiresDualSign).toBe(false);
    }
  });

  it("custom preset is minimal (cover, scope, investment, payment_terms, next_steps, acceptance only)", () => {
    const preset = presetFor("custom");
    const blockTypes = preset.blocks.map((b) => b.type);
    expect(blockTypes).toEqual(["cover", "scope", "investment", "payment_terms", "next_steps", "acceptance"]);
  });

  it.each(PROPOSAL_TYPES)("every line item has a valid kind and cadence for %s", (type) => {
    const preset = presetFor(type);
    for (const item of preset.lineItems) {
      expect(LINE_ITEM_KINDS).toContain(item.kind);
      expect(LINE_ITEM_CADENCES).toContain(item.cadence);
      expect(item.label.trim().length).toBeGreaterThan(0);
      expect(item.amount_cents).toBeGreaterThanOrEqual(0);
      expect(item.position).toBeGreaterThanOrEqual(0);
    }
  });

  it("website_build has a mutually exclusive managed-vs-ownership option group", () => {
    const preset = presetFor("website_build");
    const grouped = preset.lineItems.filter((i) => i.option_group === "ownership_path");
    expect(grouped.length).toBe(2);
    expect(grouped.filter((i) => i.is_selected)).toHaveLength(1);
  });

  it.each(PROPOSAL_TYPES)("contains no em-dashes in seeded copy for %s", (type) => {
    const preset = presetFor(type);
    expect(allText(preset)).not.toMatch(/—/);
  });

  it("every proposal type has exactly one acceptance block", () => {
    for (const type of PROPOSAL_TYPES) {
      const acceptanceBlocks = presetFor(type).blocks.filter((b) => b.type === "acceptance");
      expect(acceptanceBlocks).toHaveLength(1);
    }
  });
});
