import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { createFakeSupabase } from "@/lib/pipeline/__tests__/support/fake-supabase";

const WORKSPACE_ID = "ws-niewdel";
const VALID_TOKEN = "a".repeat(64);

let fake: ReturnType<typeof createFakeSupabase>;

vi.mock("@/lib/pipeline/db", () => ({
  getPipelineClient: () => fake.client,
  getDefaultPipelineWorkspaceId: async () => WORKSPACE_ID,
}));

// Real HMAC verification is exercised by token.test.ts; here we just need a
// deterministic gate so we can test 401/valid paths without real secrets.
vi.mock("@/lib/proposals/token", () => ({
  verifyProposalToken: (_id: string, token: string) => token === VALID_TOKEN,
  signProposalToken: () => VALID_TOKEN,
}));

const { POST: signPOST } = await import("../[id]/sign/route");
const { POST: viewPOST } = await import("../[id]/view/route");

function makeRequest(url: string, body: unknown) {
  return new NextRequest(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "user-agent": "vitest", "x-forwarded-for": "203.0.113.7" },
    body: JSON.stringify(body),
  });
}

function seedProposal(overrides: Record<string, unknown> = {}, deals: Record<string, unknown>[] = []) {
  fake = createFakeSupabase({
    crm_proposals: [
      {
        id: "prop-1",
        workspace_id: WORKSPACE_ID,
        status: "sent",
        requires_dual_sign: false,
        signed_at: null,
        signer_name: null,
        viewed_at: null,
        deal_id: null,
        title: "Test Proposal",
        ...overrides,
      },
    ],
    crm_deals: deals,
    crm_activities: [],
    crm_proposal_line_items: [
      {
        id: "li-1",
        workspace_id: WORKSPACE_ID,
        proposal_id: "prop-1",
        kind: "one_time",
        label: "Website build",
        amount_cents: 500000,
        cadence: "upfront",
        option_group: null,
        is_optional: false,
        is_selected: true,
        position: 0,
      },
      {
        id: "li-2",
        workspace_id: WORKSPACE_ID,
        proposal_id: "prop-1",
        kind: "recurring",
        label: "Care plan",
        amount_cents: 20000,
        cadence: "per_month",
        option_group: null,
        is_optional: false,
        is_selected: true,
        position: 1,
      },
    ],
    crm_proposal_events: [],
  });
}

describe("POST /api/proposals/[id]/sign", () => {
  beforeEach(() => {
    seedProposal();
  });

  it("rejects a missing token with 401", async () => {
    const res = await signPOST(
      makeRequest("http://localhost/api/proposals/prop-1/sign", {
        signerName: "Jane Doe",
        consent: true,
      }),
      { params: Promise.resolve({ id: "prop-1" }) }
    );
    expect(res.status).toBe(401);
  });

  it("rejects an invalid token with 401", async () => {
    const res = await signPOST(
      makeRequest("http://localhost/api/proposals/prop-1/sign", {
        token: "not-the-right-token",
        signerName: "Jane Doe",
        consent: true,
      }),
      { params: Promise.resolve({ id: "prop-1" }) }
    );
    expect(res.status).toBe(401);
  });

  it("rejects missing consent with 400", async () => {
    const res = await signPOST(
      makeRequest("http://localhost/api/proposals/prop-1/sign", {
        token: VALID_TOKEN,
        signerName: "Jane Doe",
        consent: false,
      }),
      { params: Promise.resolve({ id: "prop-1" }) }
    );
    expect(res.status).toBe(400);
  });

  it("rejects an empty signer name with 400", async () => {
    const res = await signPOST(
      makeRequest("http://localhost/api/proposals/prop-1/sign", {
        token: VALID_TOKEN,
        signerName: "   ",
        consent: true,
      }),
      { params: Promise.resolve({ id: "prop-1" }) }
    );
    expect(res.status).toBe(400);
  });

  it("signs successfully, writes an audit event, and snapshots totals from server-side line items (never client-supplied)", async () => {
    const res = await signPOST(
      makeRequest("http://localhost/api/proposals/prop-1/sign", {
        token: VALID_TOKEN,
        signerName: "Jane Doe",
        signerEmail: "jane@acme.com",
        consent: true,
        // Client attempts to supply a bogus total -- must be ignored.
        subtotal_cents: 1,
        selectedOptions: [],
      }),
      { params: Promise.resolve({ id: "prop-1" }) }
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.status).toBe("signed");
    expect(json.data.signer_name).toBe("Jane Doe");
    expect(json.data.signer_email).toBe("jane@acme.com");
    expect(json.data.signer_ip).toBe("203.0.113.7");
    expect(json.data.signer_consent).toBe(true);
    expect(json.data.signature_typed).toBe("Jane Doe");
    // Recomputed server-side from the two seeded line items, not "1".
    expect(json.data.subtotal_cents).toBe(500000);
    expect(json.data.recurring_monthly_cents).toBe(20000);
    expect(json.data.deposit_cents).toBe(250000);

    const events = fake.store.crm_proposal_events ?? [];
    const signedEvent = events.find((e) => e.type === "signed");
    expect(signedEvent).toBeDefined();
    expect(signedEvent?.actor).toBe("Jane Doe");
    expect(signedEvent?.ip).toBe("203.0.113.7");
    expect(signedEvent?.user_agent).toBe("vitest");
  });

  it("advances a linked deal from scope to build and logs a deal activity note on sign", async () => {
    seedProposal({ deal_id: "deal-1", title: "Acme Website Build" }, [
      { id: "deal-1", workspace_id: WORKSPACE_ID, stage: "scope" },
    ]);

    const res = await signPOST(
      makeRequest("http://localhost/api/proposals/prop-1/sign", {
        token: VALID_TOKEN,
        signerName: "Jane Doe",
        consent: true,
      }),
      { params: Promise.resolve({ id: "prop-1" }) }
    );
    expect(res.status).toBe(200);

    const deal = fake.store.crm_deals?.find((d) => d.id === "deal-1");
    expect(deal?.stage).toBe("build");

    const activities = fake.store.crm_activities ?? [];
    const note = activities.find((a) => a.deal_id === "deal-1");
    expect(note).toBeDefined();
    expect(note?.type).toBe("note");
    expect(String(note?.body)).toContain("Acme Website Build");
    expect(String(note?.body)).toContain("Jane Doe");
  });

  it("does not touch a linked deal already in build", async () => {
    seedProposal({ deal_id: "deal-1" }, [{ id: "deal-1", workspace_id: WORKSPACE_ID, stage: "build" }]);

    await signPOST(
      makeRequest("http://localhost/api/proposals/prop-1/sign", {
        token: VALID_TOKEN,
        signerName: "Jane Doe",
        consent: true,
      }),
      { params: Promise.resolve({ id: "prop-1" }) }
    );

    const deal = fake.store.crm_deals?.find((d) => d.id === "deal-1");
    expect(deal?.stage).toBe("build");
  });

  it("does nothing to any deal or activity when the proposal has no deal_id", async () => {
    seedProposal({ deal_id: null });

    await signPOST(
      makeRequest("http://localhost/api/proposals/prop-1/sign", {
        token: VALID_TOKEN,
        signerName: "Jane Doe",
        consent: true,
      }),
      { params: Promise.resolve({ id: "prop-1" }) }
    );

    expect(fake.store.crm_activities ?? []).toHaveLength(0);
  });

  it("rejects double-sign on an already-signed proposal with 409", async () => {
    seedProposal({ status: "signed", signed_at: new Date().toISOString(), signer_name: "Existing Signer" });

    const res = await signPOST(
      makeRequest("http://localhost/api/proposals/prop-1/sign", {
        token: VALID_TOKEN,
        signerName: "New Signer",
        consent: true,
      }),
      { params: Promise.resolve({ id: "prop-1" }) }
    );
    expect(res.status).toBe(409);
  });

  it("rejects signing a void proposal with 409", async () => {
    seedProposal({ status: "void" });

    const res = await signPOST(
      makeRequest("http://localhost/api/proposals/prop-1/sign", {
        token: VALID_TOKEN,
        signerName: "New Signer",
        consent: true,
      }),
      { params: Promise.resolve({ id: "prop-1" }) }
    );
    expect(res.status).toBe(409);
  });
});

describe("POST /api/proposals/[id]/view", () => {
  beforeEach(() => {
    seedProposal();
  });

  it("rejects an invalid token with 401", async () => {
    const res = await viewPOST(makeRequest("http://localhost/api/proposals/prop-1/view", { token: "nope" }), {
      params: Promise.resolve({ id: "prop-1" }),
    });
    expect(res.status).toBe(401);
  });

  it("moves a 'sent' proposal to 'viewed' and logs an event", async () => {
    const res = await viewPOST(makeRequest("http://localhost/api/proposals/prop-1/view", { token: VALID_TOKEN }), {
      params: Promise.resolve({ id: "prop-1" }),
    });
    expect(res.status).toBe(200);

    const proposal = fake.store.crm_proposals?.find((p) => p.id === "prop-1");
    expect(proposal?.status).toBe("viewed");
    expect(proposal?.viewed_at).toBeTruthy();

    const events = fake.store.crm_proposal_events ?? [];
    expect(events.some((e) => e.type === "viewed")).toBe(true);
  });

  it("does NOT downgrade an already-signed proposal back to 'viewed'", async () => {
    seedProposal({ status: "signed", signed_at: new Date().toISOString(), signer_name: "Jane Doe" });

    const res = await viewPOST(makeRequest("http://localhost/api/proposals/prop-1/view", { token: VALID_TOKEN }), {
      params: Promise.resolve({ id: "prop-1" }),
    });
    expect(res.status).toBe(200);

    const proposal = fake.store.crm_proposals?.find((p) => p.id === "prop-1");
    expect(proposal?.status).toBe("signed");
  });
});
