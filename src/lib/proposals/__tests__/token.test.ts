import { describe, it, expect, vi, beforeEach } from "vitest";
import { signProposalToken, verifyProposalToken } from "../token";

beforeEach(() => {
  vi.stubEnv("PROPOSAL_VIEW_SECRET", "test-proposal-secret");
});

describe("signProposalToken / verifyProposalToken", () => {
  it("round-trips true for the same proposal id", () => {
    const token = signProposalToken("proposal-123");
    expect(verifyProposalToken("proposal-123", token)).toBe(true);
  });

  it("returns false for a different proposal id", () => {
    const token = signProposalToken("proposal-123");
    expect(verifyProposalToken("proposal-456", token)).toBe(false);
  });

  it("returns false for a tampered token", () => {
    const token = signProposalToken("proposal-123");
    const tampered = token.slice(0, -1) + (token.at(-1) === "0" ? "1" : "0");
    expect(verifyProposalToken("proposal-123", tampered)).toBe(false);
  });

  it("returns false for a short/invalid-length token", () => {
    expect(verifyProposalToken("proposal-123", "short")).toBe(false);
  });

  it("falls back to SEO_REPORT_PRINT_SECRET when PROPOSAL_VIEW_SECRET is unset", () => {
    vi.stubEnv("PROPOSAL_VIEW_SECRET", "");
    vi.stubEnv("SEO_REPORT_PRINT_SECRET", "fallback-secret");
    const token = signProposalToken("proposal-789");
    expect(verifyProposalToken("proposal-789", token)).toBe(true);
  });
});
