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

// Imported after the mock so the route picks up the mocked module.
const { GET, POST } = await import("../activities/route");

function makeGetRequest(qs = "") {
  return new NextRequest(`http://localhost/api/pipeline/activities${qs}`);
}

function makePostRequest(body: unknown) {
  return new NextRequest("http://localhost/api/pipeline/activities", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("general activities API (company/contact scoped)", () => {
  beforeEach(() => {
    fake = createFakeSupabase({
      crm_companies: [
        { id: "co-1", workspace_id: WORKSPACE_ID, name: "Acme" },
        { id: "co-2", workspace_id: OTHER_WORKSPACE_ID, name: "Other Co" },
      ],
      crm_contacts: [
        { id: "ct-1", workspace_id: WORKSPACE_ID, full_name: "Jane Doe" },
        { id: "ct-2", workspace_id: OTHER_WORKSPACE_ID, full_name: "Other Person" },
      ],
      crm_activities: [
        { id: "act-1", workspace_id: WORKSPACE_ID, deal_id: null, crm_company_id: "co-1", contact_id: null, type: "note", body: "older company note", occurred_at: "2026-06-01T00:00:00Z" },
        { id: "act-2", workspace_id: WORKSPACE_ID, deal_id: null, crm_company_id: "co-1", contact_id: null, type: "call", body: "newer company call", occurred_at: "2026-06-15T00:00:00Z" },
        { id: "act-3", workspace_id: WORKSPACE_ID, deal_id: null, crm_company_id: null, contact_id: "ct-1", type: "note", body: "contact note", occurred_at: "2026-06-10T00:00:00Z" },
        { id: "act-4", workspace_id: OTHER_WORKSPACE_ID, deal_id: null, crm_company_id: "co-2", contact_id: null, type: "note", body: "wrong workspace", occurred_at: "2026-06-20T00:00:00Z" },
      ],
    });
  });

  it("lists a company's activities newest first, scoped to the company", async () => {
    const res = await GET(makeGetRequest("?crm_company_id=co-1"));
    const json = await res.json();
    expect(json.data.map((a: { id: string }) => a.id)).toEqual(["act-2", "act-1"]);
  });

  it("lists a contact's activities scoped to the contact", async () => {
    const res = await GET(makeGetRequest("?contact_id=ct-1"));
    const json = await res.json();
    expect(json.data.map((a: { id: string }) => a.id)).toEqual(["act-3"]);
  });

  it("does not leak activities from another workspace's company", async () => {
    const res = await GET(makeGetRequest("?crm_company_id=co-2"));
    const json = await res.json();
    expect(json.data).toEqual([]);
  });

  it("creates a company-scoped activity and returns it", async () => {
    const res = await POST(makePostRequest({ type: "note", crm_company_id: "co-1", body: "Kickoff call scheduled" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.crm_company_id).toBe("co-1");
    expect(json.data.deal_id).toBeNull();
    expect(json.data.contact_id).toBeNull();
  });

  it("creates a contact-scoped activity and returns it", async () => {
    const res = await POST(makePostRequest({ type: "call", contact_id: "ct-1", body: "Left voicemail" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.contact_id).toBe("ct-1");
  });

  it("rejects a body with no scope", async () => {
    const res = await POST(makePostRequest({ type: "note", body: "orphan note" }));
    expect(res.status).toBe(400);
  });

  it("404s when the company isn't in this workspace", async () => {
    const res = await POST(makePostRequest({ type: "note", crm_company_id: "co-2", body: "hi" }));
    expect(res.status).toBe(404);
  });

  it("404s when the contact isn't in this workspace", async () => {
    const res = await POST(makePostRequest({ type: "note", contact_id: "ct-2", body: "hi" }));
    expect(res.status).toBe(404);
  });
});
