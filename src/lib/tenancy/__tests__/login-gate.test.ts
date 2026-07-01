import { describe, expect, it } from "vitest";
import { isLoginAllowed } from "../login-gate";

describe("isLoginAllowed", () => {
  it("allows an allow-listed email even if the membership query errored", () => {
    expect(
      isLoginAllowed({
        emailAllowed: true,
        membershipRows: null,
        queryError: { message: "boom" },
      })
    ).toBe(true);
  });

  it("allows a non-allow-listed email with at least one membership row", () => {
    expect(
      isLoginAllowed({
        emailAllowed: false,
        membershipRows: [{ workspace_id: "ws-1" }],
        queryError: null,
      })
    ).toBe(true);
  });

  it("rejects a non-allow-listed email with an empty membership array", () => {
    expect(
      isLoginAllowed({
        emailAllowed: false,
        membershipRows: [],
        queryError: null,
      })
    ).toBe(false);
  });

  it("rejects a non-allow-listed email with null membership rows", () => {
    expect(
      isLoginAllowed({
        emailAllowed: false,
        membershipRows: null,
        queryError: null,
      })
    ).toBe(false);
  });

  it("fails closed on a query error even when rows are (incorrectly) present", () => {
    expect(
      isLoginAllowed({
        emailAllowed: false,
        membershipRows: [{ workspace_id: "ws-1" }],
        queryError: { message: "boom" },
      })
    ).toBe(false);
  });
});
