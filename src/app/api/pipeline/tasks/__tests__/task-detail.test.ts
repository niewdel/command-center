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
const { PATCH, DELETE } = await import("../[id]/route");

function makePatchRequest(body: unknown) {
  return new NextRequest("http://localhost/api/pipeline/tasks/task-1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("pipeline task detail API", () => {
  beforeEach(() => {
    fake = createFakeSupabase({
      crm_tasks: [
        { id: "task-1", workspace_id: WORKSPACE_ID, deal_id: null, title: "Send proposal", due_date: "2026-06-01T00:00:00Z", done: false },
        { id: "task-2", workspace_id: OTHER_WORKSPACE_ID, deal_id: null, title: "Other workspace task", due_date: null, done: false },
      ],
    });
  });

  it("toggles done", async () => {
    const res = await PATCH(makePatchRequest({ done: true }), { params: Promise.resolve({ id: "task-1" }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.done).toBe(true);
  });

  it("edits title and due date", async () => {
    const res = await PATCH(makePatchRequest({ title: "Send revised proposal", due_date: "2026-07-10T00:00:00Z" }), {
      params: Promise.resolve({ id: "task-1" }),
    });
    const json = await res.json();
    expect(json.data.title).toBe("Send revised proposal");
    expect(json.data.due_date).toBe("2026-07-10T00:00:00Z");
  });

  it("rejects blanking out the title", async () => {
    const res = await PATCH(makePatchRequest({ title: "   " }), { params: Promise.resolve({ id: "task-1" }) });
    expect(res.status).toBe(400);
  });

  it("404s toggling a task in another workspace", async () => {
    const res = await PATCH(makePatchRequest({ done: true }), { params: Promise.resolve({ id: "task-2" }) });
    expect(res.status).toBe(404);
  });

  it("deletes a task", async () => {
    const res = await DELETE(new NextRequest("http://localhost/api/pipeline/tasks/task-1", { method: "DELETE" }), {
      params: Promise.resolve({ id: "task-1" }),
    });
    expect(res.status).toBe(200);
    expect(fake.store.crm_tasks.some((t) => t.id === "task-1")).toBe(false);
  });

  it("404s deleting a task in another workspace", async () => {
    const res = await DELETE(new NextRequest("http://localhost/api/pipeline/tasks/task-2", { method: "DELETE" }), {
      params: Promise.resolve({ id: "task-2" }),
    });
    expect(res.status).toBe(404);
    expect(fake.store.crm_tasks.some((t) => t.id === "task-2")).toBe(true);
  });
});
