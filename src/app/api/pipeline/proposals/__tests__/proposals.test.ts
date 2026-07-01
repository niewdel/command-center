import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { createFakeSupabase } from "@/lib/pipeline/__tests__/support/fake-supabase";

const WORKSPACE_ID = "ws-niewdel";
const OTHER_WORKSPACE_ID = "ws-other";

let fake: ReturnType<typeof createFakeSupabase>;

vi.mock("@/lib/pipeline/db", () => ({
  getPipelineClient: () => fake.client,
  getDefaultPipelineWorkspaceId: async () => WORKSPACE_ID,
}));

const { GET: listGET, POST: listPOST } = await import("../route");
const { GET: itemGET, PATCH: itemPATCH, DELETE: itemDELETE } = await import("../[id]/route");
const { PUT: lineItemsPUT } = await import("../[id]/line-items/route");

function makeGetRequest(url: string) {
  return new NextRequest(url);
}

function makeJsonRequest(url: string, method: string, body: unknown) {
  return new NextRequest(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("proposals API", () => {
  beforeEach(() => {
    fake = createFakeSupabase({
      crm_deals: [
        {
          id: "deal-1",
          workspace_id: WORKSPACE_ID,
          title: "Acme site rebuild",
          stage: "discovery",
          crm_company_id: "co-1",
          primary_contact_id: "ct-1",
        },
        { id: "deal-2", workspace_id: OTHER_WORKSPACE_ID, title: "Other workspace deal", stage: "discovery" },
      ],
      crm_companies: [{ id: "co-1", workspace_id: WORKSPACE_ID, name: "Acme" }],
      crm_contacts: [{ id: "ct-1", workspace_id: WORKSPACE_ID, full_name: "Jane Doe" }],
    });
  });

  describe("POST /api/pipeline/proposals", () => {
    it("rejects an invalid type", async () => {
      const res = await listPOST(
        makeJsonRequest("http://localhost/api/pipeline/proposals", "POST", { type: "nonsense", title: "Test" })
      );
      expect(res.status).toBe(400);
    });

    it("rejects a missing title", async () => {
      const res = await listPOST(
        makeJsonRequest("http://localhost/api/pipeline/proposals", "POST", { type: "custom", title: "  " })
      );
      expect(res.status).toBe(400);
    });

    it("creates a proposal seeding preset blocks and line items", async () => {
      const res = await listPOST(
        makeJsonRequest("http://localhost/api/pipeline/proposals", "POST", {
          type: "website_build",
          title: "Acme Website Build",
        })
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.workspace_id).toBe(WORKSPACE_ID);
      expect(json.data.type).toBe("website_build");
      expect(json.data.content.length).toBeGreaterThan(0);
      expect(json.data.lineItems.length).toBeGreaterThan(0);
      expect(json.data.requires_dual_sign).toBe(false);
      expect(json.data.subtotal_cents).toBeGreaterThan(0);
    });

    it("marks retainer proposals as requiring dual sign", async () => {
      const res = await listPOST(
        makeJsonRequest("http://localhost/api/pipeline/proposals", "POST", { type: "retainer", title: "Retainer" })
      );
      const json = await res.json();
      expect(json.data.requires_dual_sign).toBe(true);
    });

    it("denormalizes company and contact from the deal", async () => {
      const res = await listPOST(
        makeJsonRequest("http://localhost/api/pipeline/proposals", "POST", {
          type: "custom",
          title: "Custom deal proposal",
          deal_id: "deal-1",
        })
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.crm_company_id).toBe("co-1");
      expect(json.data.primary_contact_id).toBe("ct-1");
      expect(json.data.deal_id).toBe("deal-1");
    });

    it("404s when the linked deal isn't in this workspace", async () => {
      const res = await listPOST(
        makeJsonRequest("http://localhost/api/pipeline/proposals", "POST", {
          type: "custom",
          title: "Nope",
          deal_id: "deal-2",
        })
      );
      expect(res.status).toBe(404);
    });
  });

  describe("GET /api/pipeline/proposals", () => {
    it("lists proposals newest first, scoped to the workspace", async () => {
      const first = await listPOST(
        makeJsonRequest("http://localhost/api/pipeline/proposals", "POST", { type: "custom", title: "First" })
      );
      const firstJson = await first.json();
      await new Promise((r) => setTimeout(r, 2));
      const second = await listPOST(
        makeJsonRequest("http://localhost/api/pipeline/proposals", "POST", { type: "custom", title: "Second" })
      );
      const secondJson = await second.json();

      const res = await listGET(makeGetRequest("http://localhost/api/pipeline/proposals"));
      const json = await res.json();
      expect(json.data.map((p: { id: string }) => p.id)).toEqual([secondJson.data.id, firstJson.data.id]);
    });

    it("filters by deal_id when provided", async () => {
      const forDeal = await listPOST(
        makeJsonRequest("http://localhost/api/pipeline/proposals", "POST", {
          type: "custom",
          title: "For deal-1",
          deal_id: "deal-1",
        })
      );
      const forDealJson = await forDeal.json();
      await listPOST(
        makeJsonRequest("http://localhost/api/pipeline/proposals", "POST", { type: "custom", title: "No deal" })
      );

      const res = await listGET(makeGetRequest("http://localhost/api/pipeline/proposals?deal_id=deal-1"));
      const json = await res.json();
      expect(json.data.map((p: { id: string }) => p.id)).toEqual([forDealJson.data.id]);
    });
  });

  describe("PATCH /api/pipeline/proposals/[id]", () => {
    async function createProposal(type = "custom") {
      const res = await listPOST(
        makeJsonRequest("http://localhost/api/pipeline/proposals", "POST", { type, title: "Test proposal" })
      );
      const json = await res.json();
      return json.data;
    }

    it("updates title and snapshots totals", async () => {
      const proposal = await createProposal();
      const res = await itemPATCH(
        makeJsonRequest(`http://localhost/api/pipeline/proposals/${proposal.id}`, "PATCH", {
          title: "Updated title",
        }),
        { params: Promise.resolve({ id: proposal.id }) }
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.title).toBe("Updated title");
      expect(json.data.subtotal_cents).toBe(proposal.subtotal_cents);
    });

    it("rejects edits on a signed proposal", async () => {
      const proposal = await createProposal();
      await itemPATCH(
        makeJsonRequest(`http://localhost/api/pipeline/proposals/${proposal.id}`, "PATCH", { status: "signed" }),
        { params: Promise.resolve({ id: proposal.id }) }
      );
      const res = await itemPATCH(
        makeJsonRequest(`http://localhost/api/pipeline/proposals/${proposal.id}`, "PATCH", { title: "Nope" }),
        { params: Promise.resolve({ id: proposal.id }) }
      );
      expect(res.status).toBe(400);
    });

    it("allows transitioning a signed proposal to void", async () => {
      const proposal = await createProposal();
      await itemPATCH(
        makeJsonRequest(`http://localhost/api/pipeline/proposals/${proposal.id}`, "PATCH", { status: "signed" }),
        { params: Promise.resolve({ id: proposal.id }) }
      );
      const res = await itemPATCH(
        makeJsonRequest(`http://localhost/api/pipeline/proposals/${proposal.id}`, "PATCH", { status: "void" }),
        { params: Promise.resolve({ id: proposal.id }) }
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.status).toBe("void");
    });

    it("voiding a signed proposal cannot piggyback edits to other fields in the same request", async () => {
      const proposal = await createProposal();
      await itemPATCH(
        makeJsonRequest(`http://localhost/api/pipeline/proposals/${proposal.id}`, "PATCH", { status: "signed" }),
        { params: Promise.resolve({ id: proposal.id }) }
      );
      const res = await itemPATCH(
        makeJsonRequest(`http://localhost/api/pipeline/proposals/${proposal.id}`, "PATCH", {
          status: "void",
          title: "hacked",
        }),
        { params: Promise.resolve({ id: proposal.id }) }
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.status).toBe("void");
      expect(json.data.title).toBe(proposal.title);
      expect(json.data.title).not.toBe("hacked");
    });

    it("rejects further edits once void", async () => {
      const proposal = await createProposal();
      await itemPATCH(
        makeJsonRequest(`http://localhost/api/pipeline/proposals/${proposal.id}`, "PATCH", { status: "void" }),
        { params: Promise.resolve({ id: proposal.id }) }
      );
      const res = await itemPATCH(
        makeJsonRequest(`http://localhost/api/pipeline/proposals/${proposal.id}`, "PATCH", { title: "Nope" }),
        { params: Promise.resolve({ id: proposal.id }) }
      );
      expect(res.status).toBe(400);
    });

    it("recomputes totals after a line-item change", async () => {
      const proposal = await createProposal("website_build");
      await lineItemsPUT(
        makeJsonRequest(`http://localhost/api/pipeline/proposals/${proposal.id}/line-items`, "PUT", {
          lineItems: [
            {
              kind: "one_time",
              label: "Website Build",
              amount_cents: 100000,
              cadence: "one_time",
            },
          ],
        }),
        { params: Promise.resolve({ id: proposal.id }) }
      );

      const res = await itemPATCH(
        makeJsonRequest(`http://localhost/api/pipeline/proposals/${proposal.id}`, "PATCH", { title: "Retitled" }),
        { params: Promise.resolve({ id: proposal.id }) }
      );
      const json = await res.json();
      expect(json.data.subtotal_cents).toBe(100000);
    });

    it("404s for a proposal that doesn't exist", async () => {
      const res = await itemPATCH(
        makeJsonRequest("http://localhost/api/pipeline/proposals/does-not-exist", "PATCH", { title: "Nope" }),
        { params: Promise.resolve({ id: "does-not-exist" }) }
      );
      expect(res.status).toBe(404);
    });
  });

  describe("GET /api/pipeline/proposals/[id]", () => {
    it("returns the proposal with ordered line items and events", async () => {
      const created = await listPOST(
        makeJsonRequest("http://localhost/api/pipeline/proposals", "POST", { type: "website_build", title: "Test" })
      );
      const createdJson = await created.json();

      const res = await itemGET(makeGetRequest(`http://localhost/api/pipeline/proposals/${createdJson.data.id}`), {
        params: Promise.resolve({ id: createdJson.data.id }),
      });
      const json = await res.json();
      expect(json.data.lineItems.length).toBeGreaterThan(0);
      expect(json.data.events.length).toBeGreaterThan(0);
      expect(json.data.events[0].type).toBe("created");
    });
  });

  describe("DELETE /api/pipeline/proposals/[id]", () => {
    it("deletes a proposal", async () => {
      const created = await listPOST(
        makeJsonRequest("http://localhost/api/pipeline/proposals", "POST", { type: "custom", title: "To delete" })
      );
      const createdJson = await created.json();

      const res = await itemDELETE(makeGetRequest(`http://localhost/api/pipeline/proposals/${createdJson.data.id}`), {
        params: Promise.resolve({ id: createdJson.data.id }),
      });
      expect(res.status).toBe(200);

      const getRes = await itemGET(
        makeGetRequest(`http://localhost/api/pipeline/proposals/${createdJson.data.id}`),
        { params: Promise.resolve({ id: createdJson.data.id }) }
      );
      expect(getRes.status).toBe(404);
    });
  });
});
