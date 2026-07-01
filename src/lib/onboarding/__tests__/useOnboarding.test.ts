import { describe, it, expect, vi } from "vitest";
import { loadOnboarding, persistOnboarding, type OnboardingSupabaseClient } from "../useOnboarding";

type Row = {
  user_id: string;
  onboarding_completed_at: string | null;
  onboarding_step: number;
  onboarding_checklist: Record<string, boolean> | null;
};

/** Minimal mock of OnboardingSupabaseClient over an in-memory row map. */
function createMockClient(userId: string | null, rows: Record<string, Row> = {}) {
  const upsertCalls: Record<string, unknown>[] = [];

  const client: OnboardingSupabaseClient = {
    auth: {
      getUser: () => Promise.resolve({ data: { user: userId ? { id: userId } : null } }),
    },
    from: () => ({
      select: () => ({
        eq: (_col: string, val: string) => ({
          maybeSingle: () =>
            Promise.resolve({
              data: rows[val] ?? null,
              error: null,
            }),
        }),
      }),
      upsert: (row) => {
        upsertCalls.push(row);
        const uid = row.user_id as string;
        rows[uid] = { ...(rows[uid] ?? { user_id: uid, onboarding_completed_at: null, onboarding_step: 0, onboarding_checklist: {} }), ...row } as Row;
        return Promise.resolve({ error: null });
      },
    }),
  };

  return { client, rows, upsertCalls };
}

describe("loadOnboarding", () => {
  it("returns the default state and no userId when signed out", async () => {
    const { client } = createMockClient(null);
    const result = await loadOnboarding(client);
    expect(result.userId).toBeNull();
    expect(result.state).toEqual({ completedAt: null, step: 0, checklist: {} });
  });

  it("maps an existing row to onboarding state", async () => {
    const { client } = createMockClient("user-1", {
      "user-1": {
        user_id: "user-1",
        onboarding_completed_at: "2026-06-01T00:00:00Z",
        onboarding_step: 2,
        onboarding_checklist: { create_first_deal: true },
      },
    });
    const result = await loadOnboarding(client);
    expect(result.userId).toBe("user-1");
    expect(result.state).toEqual({
      completedAt: "2026-06-01T00:00:00Z",
      step: 2,
      checklist: { create_first_deal: true },
    });
  });

  it("upserts a fresh row and returns default state when none exists yet", async () => {
    const { client, upsertCalls } = createMockClient("user-2", {});
    const result = await loadOnboarding(client);
    expect(result.userId).toBe("user-2");
    expect(result.state).toEqual({ completedAt: null, step: 0, checklist: {} });
    expect(upsertCalls).toHaveLength(1);
    expect(upsertCalls[0]).toMatchObject({ user_id: "user-2" });
  });
});

describe("persistOnboarding", () => {
  it("upserts the patch scoped to the given user", async () => {
    const { client, upsertCalls } = createMockClient("user-3");
    await persistOnboarding(client, "user-3", { onboarding_step: 5 });
    expect(upsertCalls).toHaveLength(1);
    expect(upsertCalls[0]).toEqual({ user_id: "user-3", onboarding_step: 5 });
  });

  it("persists completion with a timestamp", async () => {
    const { client, rows } = createMockClient("user-4");
    await persistOnboarding(client, "user-4", { onboarding_completed_at: "2026-07-01T09:00:00Z" });
    expect(rows["user-4"].onboarding_completed_at).toBe("2026-07-01T09:00:00Z");
  });

  it("persists a checklist toggle", async () => {
    const { client, rows } = createMockClient("user-5");
    await persistOnboarding(client, "user-5", { onboarding_checklist: { set_next_action: true } });
    expect(rows["user-5"].onboarding_checklist).toEqual({ set_next_action: true });
  });
});

describe("mock client sanity", () => {
  it("vi.fn spies can wrap the mock client's auth.getUser", async () => {
    const { client } = createMockClient("user-6");
    const spy = vi.fn(client.auth.getUser);
    const { data } = await spy();
    expect(data.user?.id).toBe("user-6");
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
