import { describe, it, expect, beforeAll } from "vitest";

// The Customer Portal (/portal/[id]) reuses the same non-expiring view
// token as the standalone report magic link. This test exercises the gate
// logic the portal page and middleware both depend on.

beforeAll(() => {
  process.env.SEO_REPORT_PRINT_SECRET = "test-secret-for-portal-token-tests";
});

describe("verifyViewToken (portal access gate)", () => {
  it("accepts a token signed for the same client", async () => {
    const { signViewToken, verifyViewToken } = await import(
      "../report-print-token"
    );
    const token = signViewToken("client-123");
    expect(verifyViewToken("client-123", token)).toBe(true);
  });

  it("rejects a token signed for a different client", async () => {
    const { signViewToken, verifyViewToken } = await import(
      "../report-print-token"
    );
    const token = signViewToken("client-123");
    expect(verifyViewToken("client-456", token)).toBe(false);
  });

  it("rejects a malformed/short token", async () => {
    const { verifyViewToken } = await import("../report-print-token");
    expect(verifyViewToken("client-123", "not-a-real-token")).toBe(false);
  });

  it("rejects a missing token", async () => {
    const { verifyViewToken } = await import("../report-print-token");
    // @ts-expect-error — exercising the runtime guard against non-string input
    expect(verifyViewToken("client-123", undefined)).toBe(false);
  });
});
