import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetUser = vi.fn();
const mockOrder = vi.fn();
const mockCookieGet = vi.fn();

vi.mock("@/lib/supabase-server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: vi.fn(() => ({
      select: vi.fn(() => ({ order: mockOrder })),
    })),
  })),
}));
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: mockCookieGet })),
}));

import { resolveActiveWorkspace } from "@/lib/tenancy";

const WORKSPACES = [
  { id: "ws-niewdel", slug: "niewdel", name: "Niewdel", kind: "internal" },
  { id: "ws-demo", slug: "demo", name: "Demo", kind: "demo" },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
  mockOrder.mockResolvedValue({ data: WORKSPACES });
});

describe("resolveActiveWorkspace", () => {
  it("returns null when there is no session", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    expect(await resolveActiveWorkspace()).toBeNull();
  });

  it("returns null when the user has no visible workspaces", async () => {
    mockOrder.mockResolvedValue({ data: [] });
    expect(await resolveActiveWorkspace()).toBeNull();
  });

  it("honors a valid active_workspace cookie", async () => {
    mockCookieGet.mockReturnValue({ value: "ws-demo" });
    expect((await resolveActiveWorkspace())?.id).toBe("ws-demo");
  });

  it("rejects a cookie for a workspace the user cannot see (falls back)", async () => {
    mockCookieGet.mockReturnValue({ value: "ws-foreign" });
    expect((await resolveActiveWorkspace())?.id).toBe("ws-niewdel");
  });

  it("defaults to niewdel when no cookie and niewdel is visible", async () => {
    mockCookieGet.mockReturnValue(undefined);
    expect((await resolveActiveWorkspace())?.slug).toBe("niewdel");
  });

  it("defaults to the first membership when niewdel is not visible", async () => {
    mockCookieGet.mockReturnValue(undefined);
    mockOrder.mockResolvedValue({ data: [WORKSPACES[1]] });
    expect((await resolveActiveWorkspace())?.slug).toBe("demo");
  });
});
