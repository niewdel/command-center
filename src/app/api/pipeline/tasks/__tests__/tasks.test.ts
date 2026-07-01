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
const { GET, POST } = await import("../route");

function makeGetRequest(qs = "") {
  return new NextRequest(`http://localhost/api/pipeline/tasks${qs}`);
}

function makePostRequest(body: unknown) {
  return new NextRequest("http://localhost/api/pipeline/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// "Now" the overdue filter compares against — matches the fixture below.
const NOW = new Date("2026-07-01T12:00:00Z");

describe("pipeline tasks API", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);

    fake = createFakeSupabase({
      crm_deals: [
        { id: "deal-1", workspace_id: WORKSPACE_ID, title: "Acme site rebuild", stage: "discovery" },
        { id: "deal-2", workspace_id: OTHER_WORKSPACE_ID, title: "Other workspace deal", stage: "discovery" },
      ],
      crm_tasks: [
        { id: "task-1", workspace_id: WORKSPACE_ID, deal_id: "deal-1", title: "Send proposal", due_date: "2026-06-01T00:00:00Z", done: false },
        { id: "task-2", workspace_id: WORKSPACE_ID, deal_id: "deal-1", title: "Follow up call", due_date: "2026-08-01T00:00:00Z", done: false },
        { id: "task-3", workspace_id: WORKSPACE_ID, deal_id: null, title: "Already done", due_date: "2026-06-01T00:00:00Z", done: true },
        { id: "task-4", workspace_id: OTHER_WORKSPACE_ID, deal_id: "deal-2", title: "Wrong workspace task", due_date: null, done: false },
      ],
    });
  });

  it("lists tasks scoped to the workspace", async () => {
    const res = await GET(makeGetRequest());
    const json = await res.json();
    expect(json.data.map((t: { id: string }) => t.id).sort()).toEqual(["task-1", "task-2", "task-3"]);
  });

  it("filters by done=false", async () => {
    const res = await GET(makeGetRequest("?done=false"));
    const json = await res.json();
    expect(json.data.map((t: { id: string }) => t.id).sort()).toEqual(["task-1", "task-2"]);
  });

  it("filters by done=true", async () => {
    const res = await GET(makeGetRequest("?done=true"));
    const json = await res.json();
    expect(json.data.map((t: { id: string }) => t.id)).toEqual(["task-3"]);
  });

  it("filters by deal_id", async () => {
    const res = await GET(makeGetRequest("?deal_id=deal-1"));
    const json = await res.json();
    expect(json.data).toHaveLength(2);
    expect(json.data.every((t: { deal_id: string }) => t.deal_id === "deal-1")).toBe(true);
  });

  it("filters overdue: not done and due before now", async () => {
    const res = await GET(makeGetRequest("?overdue=true"));
    const json = await res.json();
    expect(json.data.map((t: { id: string }) => t.id)).toEqual(["task-1"]);
  });

  it("creates a task and returns it", async () => {
    const res = await POST(makePostRequest({ title: "Call Kyle", due_date: "2026-07-05T00:00:00Z", deal_id: "deal-1" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.title).toBe("Call Kyle");
    expect(json.data.done).toBe(false);
    expect(json.data.workspace_id).toBe(WORKSPACE_ID);
    expect(json.data.deal_id).toBe("deal-1");
  });

  it("creates a task with no linkage", async () => {
    const res = await POST(makePostRequest({ title: "General follow-up" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.deal_id).toBeNull();
  });

  it("rejects an empty title", async () => {
    const res = await POST(makePostRequest({ title: "   " }));
    expect(res.status).toBe(400);
  });

  it("404s when the linked deal isn't in this workspace", async () => {
    const res = await POST(makePostRequest({ title: "Nope", deal_id: "deal-2" }));
    expect(res.status).toBe(404);
  });
});
