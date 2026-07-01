import { describe, it, expect } from "vitest";
import {
  activeRecurringItems,
  computeMrr,
  mrrByCompany,
  newMrrThisMonth,
  type ProposalForMrr,
} from "../mrr";
import type { CrmProposalLineItem, ProposalStatus } from "@/types/proposals";

let itemCounter = 0;
let proposalCounter = 0;

function lineItem(overrides: Partial<CrmProposalLineItem> = {}): CrmProposalLineItem {
  itemCounter += 1;
  return {
    id: `item-${itemCounter}`,
    workspace_id: "ws-1",
    proposal_id: "prop-1",
    kind: "recurring",
    label: `Item ${itemCounter}`,
    description: null,
    badge: null,
    amount_cents: 0,
    cadence: "per_month",
    recurring_months: null,
    option_group: null,
    is_optional: false,
    is_selected: true,
    position: itemCounter,
    created_at: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

function proposal(overrides: Partial<ProposalForMrr> = {}): ProposalForMrr {
  proposalCounter += 1;
  return {
    id: `prop-${proposalCounter}`,
    status: "signed" as ProposalStatus,
    signed_at: "2026-07-01T00:00:00.000Z",
    crm_company_id: "company-1",
    company: { id: "company-1", name: "Acme Co" },
    lineItems: [],
    ...overrides,
  };
}

describe("activeRecurringItems", () => {
  it("includes recurring, selected items only from signed proposals", () => {
    const signed = proposal({
      status: "signed",
      lineItems: [
        lineItem({ kind: "recurring", amount_cents: 500_00 }),
        lineItem({ kind: "one_time", amount_cents: 1000_00 }),
      ],
    });
    const draft = proposal({
      status: "draft",
      lineItems: [lineItem({ kind: "recurring", amount_cents: 300_00 })],
    });

    const result = activeRecurringItems([signed, draft]);
    expect(result).toHaveLength(1);
    expect(result[0].amount_cents).toBe(500_00);
  });

  it("excludes draft/sent/viewed/declined proposals", () => {
    const statuses: ProposalStatus[] = ["draft", "sent", "viewed", "declined", "void"];
    const proposals = statuses.map((status) =>
      proposal({ status, lineItems: [lineItem({ kind: "recurring", amount_cents: 200_00 })] })
    );
    expect(activeRecurringItems(proposals)).toHaveLength(0);
  });

  it("excludes unselected optional recurring items via resolveSelectedItems", () => {
    const p = proposal({
      lineItems: [
        lineItem({ kind: "recurring", amount_cents: 400_00, is_optional: true, is_selected: false }),
        lineItem({ kind: "recurring", amount_cents: 600_00, is_optional: false, is_selected: true }),
      ],
    });
    const result = activeRecurringItems([p]);
    expect(result).toHaveLength(1);
    expect(result[0].amount_cents).toBe(600_00);
  });

  it("resolves option-group picks (only the selected one counts)", () => {
    const p = proposal({
      lineItems: [
        lineItem({ kind: "recurring", amount_cents: 300_00, option_group: "plan", is_selected: true, position: 1 }),
        lineItem({ kind: "recurring", amount_cents: 900_00, option_group: "plan", is_selected: false, position: 2 }),
      ],
    });
    const result = activeRecurringItems([p]);
    expect(result).toHaveLength(1);
    expect(result[0].amount_cents).toBe(300_00);
  });
});

describe("computeMrr", () => {
  it("sums recurring monthly across multiple signed proposals; ARR = MRR x 12", () => {
    const p1 = proposal({ lineItems: [lineItem({ kind: "recurring", amount_cents: 500_00 })] });
    const p2 = proposal({ lineItems: [lineItem({ kind: "recurring", amount_cents: 250_00 })] });
    const result = computeMrr([p1, p2]);
    expect(result.mrrCents).toBe(750_00);
    expect(result.arrCents).toBe(750_00 * 12);
  });

  it("counts active contracts as proposals contributing recurring revenue", () => {
    const withRecurring = proposal({ lineItems: [lineItem({ kind: "recurring", amount_cents: 500_00 })] });
    const oneTimeOnly = proposal({ lineItems: [lineItem({ kind: "one_time", amount_cents: 1000_00 })] });
    const result = computeMrr([withRecurring, oneTimeOnly]);
    expect(result.activeContracts).toBe(1);
  });

  it("splits evergreen (recurring_months = null) vs finite-term recurring", () => {
    const p = proposal({
      lineItems: [
        lineItem({ kind: "recurring", amount_cents: 400_00, recurring_months: null }),
        lineItem({ kind: "recurring", amount_cents: 100_00, recurring_months: 6 }),
      ],
    });
    const result = computeMrr([p]);
    expect(result.evergreenCents).toBe(400_00);
    expect(result.finiteCents).toBe(100_00);
    expect(result.mrrCents).toBe(500_00);
  });

  it("excludes non-signed proposals and non-recurring/unselected items", () => {
    const draft = proposal({ status: "draft", lineItems: [lineItem({ kind: "recurring", amount_cents: 999_00 })] });
    const signedOneTime = proposal({
      lineItems: [lineItem({ kind: "one_time", amount_cents: 500_00 })],
    });
    const unselectedOptional = proposal({
      lineItems: [lineItem({ kind: "recurring", amount_cents: 777_00, is_optional: true, is_selected: false })],
    });
    const result = computeMrr([draft, signedOneTime, unselectedOptional]);
    expect(result.mrrCents).toBe(0);
    expect(result.arrCents).toBe(0);
    expect(result.activeContracts).toBe(0);
  });

  it("returns zeroed result for an empty list", () => {
    const result = computeMrr([]);
    expect(result).toEqual({
      mrrCents: 0,
      arrCents: 0,
      activeContracts: 0,
      evergreenCents: 0,
      finiteCents: 0,
    });
  });
});

describe("mrrByCompany", () => {
  it("groups recurring MRR by company and sorts descending", () => {
    const acme1 = proposal({
      crm_company_id: "company-acme",
      company: { id: "company-acme", name: "Acme Co" },
      lineItems: [lineItem({ kind: "recurring", amount_cents: 200_00 })],
    });
    const acme2 = proposal({
      crm_company_id: "company-acme",
      company: { id: "company-acme", name: "Acme Co" },
      lineItems: [lineItem({ kind: "recurring", amount_cents: 300_00 })],
    });
    const globex = proposal({
      crm_company_id: "company-globex",
      company: { id: "company-globex", name: "Globex" },
      lineItems: [lineItem({ kind: "recurring", amount_cents: 1000_00 })],
    });

    const result = mrrByCompany([acme1, acme2, globex]);
    expect(result).toEqual([
      { companyId: "company-globex", companyName: "Globex", mrrCents: 1000_00 },
      { companyId: "company-acme", companyName: "Acme Co", mrrCents: 500_00 },
    ]);
  });

  it("omits companies with no active recurring revenue", () => {
    const oneTimeOnly = proposal({
      crm_company_id: "company-x",
      company: { id: "company-x", name: "X Corp" },
      lineItems: [lineItem({ kind: "one_time", amount_cents: 500_00 })],
    });
    expect(mrrByCompany([oneTimeOnly])).toEqual([]);
  });
});

describe("newMrrThisMonth", () => {
  const now = new Date("2026-07-15T12:00:00.000Z");

  it("only counts proposals signed in the current UTC calendar month", () => {
    const thisMonth = proposal({
      signed_at: "2026-07-01T00:00:00.000Z",
      lineItems: [lineItem({ kind: "recurring", amount_cents: 400_00 })],
    });
    const lastMonth = proposal({
      signed_at: "2026-06-30T23:59:59.000Z",
      lineItems: [lineItem({ kind: "recurring", amount_cents: 900_00 })],
    });
    const nextMonth = proposal({
      signed_at: "2026-08-01T00:00:00.000Z",
      lineItems: [lineItem({ kind: "recurring", amount_cents: 900_00 })],
    });

    expect(newMrrThisMonth([thisMonth, lastMonth, nextMonth], now)).toBe(400_00);
  });

  it("returns 0 when nothing signed this month", () => {
    const lastMonth = proposal({
      signed_at: "2026-06-01T00:00:00.000Z",
      lineItems: [lineItem({ kind: "recurring", amount_cents: 400_00 })],
    });
    expect(newMrrThisMonth([lastMonth], now)).toBe(0);
  });

  it("ignores proposals with no signed_at", () => {
    const noSignedAt = proposal({
      signed_at: null,
      lineItems: [lineItem({ kind: "recurring", amount_cents: 400_00 })],
    });
    expect(newMrrThisMonth([noSignedAt], now)).toBe(0);
  });
});
