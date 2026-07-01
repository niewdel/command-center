import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { createFakeSupabase } from "@/lib/pipeline/__tests__/support/fake-supabase";

const WORKSPACE_ID = "ws-1";
const OTHER_WORKSPACE_ID = "ws-other";

let fake: ReturnType<typeof createFakeSupabase>;

vi.mock("@/lib/tenancy", () => ({
  getUserScopedClient: vi.fn(async () => fake.client),
  resolveActiveWorkspace: vi.fn(async () => ({
    id: WORKSPACE_ID,
    slug: "niewdel",
    name: "Niewdel",
    kind: "internal",
  })),
}));

// Imported after the mock so the route picks up the mocked module.
const { GET, POST } = await import("../[id]/activities/route");

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/pipeline/deals/deal-1/activities", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("deal activities API", () => {
  beforeEach(() => {
    fake = createFakeSupabase({
      crm_deals: [
        { id: "deal-1", workspace_id: WORKSPACE_ID, title: "Acme site rebuild", stage: "discovery" },
        { id: "deal-2", workspace_id: OTHER_WORKSPACE_ID, title: "Other workspace deal", stage: "discovery" },
      ],
      crm_activities: [
        { id: "act-1", workspace_id: WORKSPACE_ID, deal_id: "deal-1", type: "note", body: "older note", occurred_at: "2026-06-01T00:00:00Z" },
        { id: "act-2", workspace_id: WORKSPACE_ID, deal_id: "deal-1", type: "call", body: "newer call", occurred_at: "2026-06-15T00:00:00Z" },
        { id: "act-3", workspace_id: OTHER_WORKSPACE_ID, deal_id: "deal-2", type: "note", body: "wrong workspace", occurred_at: "2026-06-20T00:00:00Z" },
      ],
    });
  });

  it("lists a deal's activities newest first, scoped to the deal", async () => {
    const res = await GET(new NextRequest("http://localhost/api/pipeline/deals/deal-1/activities"), {
      params: Promise.resolve({ id: "deal-1" }),
    });
    const json = await res.json();
    expect(json.data.map((a: { id: string }) => a.id)).toEqual(["act-2", "act-1"]);
  });

  it("does not leak activities from another workspace's deal", async () => {
    const res = await GET(new NextRequest("http://localhost/api/pipeline/deals/deal-2/activities"), {
      params: Promise.resolve({ id: "deal-2" }),
    });
    const json = await res.json();
    expect(json.data).toEqual([]);
  });

  it("creates a note activity and returns it", async () => {
    const res = await POST(makeRequest({ type: "note", body: "Called them, waiting on budget sign-off" }), {
      params: Promise.resolve({ id: "deal-1" }),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.type).toBe("note");
    expect(json.data.body).toBe("Called them, waiting on budget sign-off");
    expect(json.data.workspace_id).toBe(WORKSPACE_ID);
    expect(json.data.deal_id).toBe("deal-1");

    const listRes = await GET(new NextRequest("http://localhost/api/pipeline/deals/deal-1/activities"), {
      params: Promise.resolve({ id: "deal-1" }),
    });
    const listJson = await listRes.json();
    expect(listJson.data).toHaveLength(3);
  });

  it("rejects an empty body", async () => {
    const res = await POST(makeRequest({ type: "note", body: "   " }), { params: Promise.resolve({ id: "deal-1" }) });
    expect(res.status).toBe(400);
  });

  it("rejects an invalid type", async () => {
    const res = await POST(makeRequest({ type: "carrier_pigeon", body: "hi" }), {
      params: Promise.resolve({ id: "deal-1" }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects logging a stage_change directly (server-generated only)", async () => {
    const res = await POST(makeRequest({ type: "stage_change", body: "Moved from A to B" }), {
      params: Promise.resolve({ id: "deal-1" }),
    });
    expect(res.status).toBe(400);
  });

  it("404s when the deal isn't in this workspace", async () => {
    const res = await POST(makeRequest({ type: "note", body: "hi" }), { params: Promise.resolve({ id: "deal-2" }) });
    expect(res.status).toBe(404);
  });
});
