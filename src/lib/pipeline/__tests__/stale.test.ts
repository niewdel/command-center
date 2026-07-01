import { describe, it, expect } from "vitest";
import { isDealStale, buildStageChangeBody } from "../stale";

const NOW = new Date("2026-07-01T12:00:00Z");

describe("isDealStale", () => {
  it("flags an open-stage deal with no next_action_at", () => {
    expect(isDealStale({ stage: "discovery", next_action_at: null }, NOW)).toBe(true);
  });

  it("flags an open-stage deal with a past-due next_action_at", () => {
    expect(isDealStale({ stage: "proposal", next_action_at: "2026-06-01T00:00:00Z" }, NOW)).toBe(true);
  });

  it("does not flag an open-stage deal with a future next_action_at", () => {
    expect(isDealStale({ stage: "scope", next_action_at: "2026-08-01T00:00:00Z" }, NOW)).toBe(false);
  });

  it("never flags a live deal, even with no next_action_at", () => {
    expect(isDealStale({ stage: "live", next_action_at: null }, NOW)).toBe(false);
  });

  it("never flags a lost deal", () => {
    expect(isDealStale({ stage: "lost", next_action_at: null }, NOW)).toBe(false);
  });

  it("never flags a disqualified deal", () => {
    expect(isDealStale({ stage: "disqualified", next_action_at: "2026-01-01T00:00:00Z" }, NOW)).toBe(false);
  });

  it("covers every open stage (discovery/scope/proposal/build)", () => {
    for (const stage of ["discovery", "scope", "proposal", "build"] as const) {
      expect(isDealStale({ stage, next_action_at: null }, NOW)).toBe(true);
    }
  });
});

describe("buildStageChangeBody", () => {
  it("renders a human-readable stage transition", () => {
    expect(buildStageChangeBody("discovery", "proposal")).toBe("Moved from Discovery Call to Proposal Sent");
  });
});
