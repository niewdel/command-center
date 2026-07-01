import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { createFakeSupabase } from "@/lib/pipeline/__tests__/support/fake-supabase";

const WORKSPACE_ID = "ws-1";

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

const { PATCH } = await import("../[id]/route");

function patchRequest(body: unknown) {
  return new NextRequest("http://localhost/api/pipeline/deals/deal-1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("deal PATCH — stage_change auto-logging", () => {
  beforeEach(() => {
    fake = createFakeSupabase({
      crm_deals: [{ id: "deal-1", workspace_id: WORKSPACE_ID, title: "Acme site rebuild", stage: "discovery" }],
      crm_activities: [],
    });
  });

  it("auto-logs a stage_change activity when the stage moves", async () => {
    const res = await PATCH(patchRequest({ stage: "proposal" }), { params: Promise.resolve({ id: "deal-1" }) });
    expect(res.status).toBe(200);

    expect(fake.store.crm_activities).toHaveLength(1);
    const activity = fake.store.crm_activities[0];
    expect(activity.type).toBe("stage_change");
    expect(activity.body).toBe("Moved from Discovery Call to Proposal Sent");
    expect(activity.deal_id).toBe("deal-1");
    expect(activity.workspace_id).toBe(WORKSPACE_ID);
  });

  it("does not log an activity when the stage is unchanged", async () => {
    await PATCH(patchRequest({ stage: "discovery" }), { params: Promise.resolve({ id: "deal-1" }) });
    expect(fake.store.crm_activities).toHaveLength(0);
  });

  it("does not log a stage_change when patching unrelated fields", async () => {
    await PATCH(patchRequest({ notes: "Following up next week" }), { params: Promise.resolve({ id: "deal-1" }) });
    expect(fake.store.crm_activities).toHaveLength(0);
  });

  it("sets next_action_at via the same PATCH handler", async () => {
    const iso = "2026-07-10T15:00:00.000Z";
    const res = await PATCH(patchRequest({ next_action_at: iso }), { params: Promise.resolve({ id: "deal-1" }) });
    const json = await res.json();
    expect(json.data.next_action_at).toBe(iso);
  });
});
