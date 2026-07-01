import { describe, it, expect } from "vitest";
import {
  resolveSelectedItems,
  computeTotals,
  nMonthTotal,
  formatCents,
} from "../pricing";
import type { CrmProposalLineItem } from "@/types/proposals";

let counter = 0;

function item(overrides: Partial<CrmProposalLineItem> = {}): CrmProposalLineItem {
  counter += 1;
  return {
    id: `item-${counter}`,
    workspace_id: "ws-1",
    proposal_id: "prop-1",
    kind: "one_time",
    label: `Item ${counter}`,
    description: null,
    badge: null,
    amount_cents: 0,
    cadence: "one_time",
    recurring_months: null,
    option_group: null,
    is_optional: false,
    is_selected: true,
    position: counter,
    created_at: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("resolveSelectedItems", () => {
  it("keeps always-included items (no option_group, not optional)", () => {
    const items = [item({ label: "Base build", amount_cents: 500_00 })];
    expect(resolveSelectedItems(items)).toHaveLength(1);
  });

  it("drops unselected optional items", () => {
    const items = [
      item({ label: "Core", amount_cents: 100_00 }),
      item({ label: "Extra", amount_cents: 50_00, is_optional: true, is_selected: false }),
    ];
    const resolved = resolveSelectedItems(items);
    expect(resolved.map((i) => i.label)).toEqual(["Core"]);
  });

  it("keeps a selected optional item", () => {
    const items = [
      item({ label: "Extra", amount_cents: 50_00, is_optional: true, is_selected: true }),
    ];
    expect(resolveSelectedItems(items)).toHaveLength(1);
  });

  it("in an option_group with two options, only the selected one counts", () => {
    const items = [
      item({ label: "Plan A", option_group: "hosting", amount_cents: 100_00, position: 0, is_selected: true }),
      item({ label: "Plan B", option_group: "hosting", amount_cents: 200_00, position: 1, is_selected: false }),
    ];
    const resolved = resolveSelectedItems(items);
    expect(resolved.map((i) => i.label)).toEqual(["Plan A"]);
  });

  it("switching the selection within an option_group changes which item counts", () => {
    const items = [
      item({ label: "Plan A", option_group: "hosting", amount_cents: 100_00, position: 0, is_selected: false }),
      item({ label: "Plan B", option_group: "hosting", amount_cents: 200_00, position: 1, is_selected: true }),
    ];
    const resolved = resolveSelectedItems(items);
    expect(resolved.map((i) => i.label)).toEqual(["Plan B"]);
  });

  it("falls back to the first item by position when none in the group is selected", () => {
    const items = [
      item({ label: "Plan B", option_group: "hosting", amount_cents: 200_00, position: 1, is_selected: false }),
      item({ label: "Plan A", option_group: "hosting", amount_cents: 100_00, position: 0, is_selected: false }),
    ];
    const resolved = resolveSelectedItems(items);
    expect(resolved.map((i) => i.label)).toEqual(["Plan A"]);
    expect(resolved[0].is_selected).toBe(true);
  });
});

describe("computeTotals", () => {
  it("sums mixed one_time / recurring / handoff totals", () => {
    const items = [
      item({ kind: "one_time", amount_cents: 200_00 }),
      item({ kind: "recurring", amount_cents: 50_00 }),
      item({ kind: "handoff", amount_cents: 25_00 }),
    ];
    const totals = computeTotals(items);
    expect(totals.oneTimeCents).toBe(200_00);
    expect(totals.recurringMonthlyCents).toBe(50_00);
    expect(totals.handoffCents).toBe(25_00);
    expect(totals.depositCents).toBe(100_00);
  });

  it("counts both evergreen (null recurring_months) and finite recurring items in monthly total", () => {
    const items = [
      item({ kind: "recurring", amount_cents: 100_00, recurring_months: null }),
      item({ kind: "recurring", amount_cents: 50_00, recurring_months: 6 }),
    ];
    const totals = computeTotals(items);
    expect(totals.recurringMonthlyCents).toBe(150_00);
  });

  it("only counts the selected option in an option_group toward totals", () => {
    const items = [
      item({ label: "Plan A", option_group: "hosting", amount_cents: 100_00, position: 0, is_selected: true, kind: "recurring" }),
      item({ label: "Plan B", option_group: "hosting", amount_cents: 200_00, position: 1, is_selected: false, kind: "recurring" }),
    ];
    expect(computeTotals(items).recurringMonthlyCents).toBe(100_00);

    const switched = [
      item({ label: "Plan A", option_group: "hosting", amount_cents: 100_00, position: 0, is_selected: false, kind: "recurring" }),
      item({ label: "Plan B", option_group: "hosting", amount_cents: 200_00, position: 1, is_selected: true, kind: "recurring" }),
    ];
    expect(computeTotals(switched).recurringMonthlyCents).toBe(200_00);
  });

  it("excludes an optional item toggled off", () => {
    const items = [
      item({ kind: "one_time", amount_cents: 100_00 }),
      item({ kind: "one_time", amount_cents: 50_00, is_optional: true, is_selected: false }),
    ];
    expect(computeTotals(items).oneTimeCents).toBe(100_00);
  });

  it("rounds the deposit correctly on odd cents", () => {
    const items = [item({ kind: "one_time", amount_cents: 123_45 })];
    // 12345 * 0.5 = 6172.5 -> rounds to 6173 (Math.round)
    expect(computeTotals(items).depositCents).toBe(6173);
  });
});

describe("nMonthTotal", () => {
  it("sums oneTime + handoff + recurringMonthly x months", () => {
    const items = [
      item({ kind: "one_time", amount_cents: 500_00 }),
      item({ kind: "handoff", amount_cents: 100_00 }),
      item({ kind: "recurring", amount_cents: 200_00 }),
    ];
    expect(nMonthTotal(items, 1)).toBe(500_00 + 100_00 + 200_00);
    expect(nMonthTotal(items, 6)).toBe(500_00 + 100_00 + 200_00 * 6);
    expect(nMonthTotal(items, 12)).toBe(500_00 + 100_00 + 200_00 * 12);
  });

  it("respects option_group resolution when computing n-month totals", () => {
    const items = [
      item({ label: "Plan A", option_group: "hosting", amount_cents: 100_00, position: 0, is_selected: true, kind: "recurring" }),
      item({ label: "Plan B", option_group: "hosting", amount_cents: 200_00, position: 1, is_selected: false, kind: "recurring" }),
    ];
    expect(nMonthTotal(items, 3)).toBe(300_00);
  });
});

describe("formatCents", () => {
  it("formats whole dollars without cents", () => {
    expect(formatCents(1_234_00)).toBe("$1,234");
  });

  it("formats cents when not a whole dollar amount", () => {
    expect(formatCents(1_234_56)).toBe("$1,234.56");
  });

  it("formats zero", () => {
    expect(formatCents(0)).toBe("$0");
  });

  it("formats negative amounts sanely", () => {
    expect(formatCents(-500)).toBe("-$5");
    expect(formatCents(-550)).toBe("-$5.50");
  });
});
