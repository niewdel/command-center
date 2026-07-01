import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetUser = vi.fn();
const mockRpc = vi.fn();

vi.mock("@/lib/supabase-server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    rpc: mockRpc,
  })),
}));
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: vi.fn() })),
}));

import { requireAgencyAdmin } from "@/lib/tenancy";

beforeEach(() => {
  vi.clearAllMocks();
  mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
  mockRpc.mockResolvedValue({ data: true, error: null });
});

describe("requireAgencyAdmin", () => {
  it("returns the user id for an agency admin", async () => {
    expect(await requireAgencyAdmin()).toEqual({ userId: "u1" });
    expect(mockRpc).toHaveBeenCalledWith("is_agency_admin", { uid: "u1" });
  });

  it("returns null when there is no session", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    expect(await requireAgencyAdmin()).toBeNull();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("returns null for a non-admin member", async () => {
    mockRpc.mockResolvedValue({ data: false, error: null });
    expect(await requireAgencyAdmin()).toBeNull();
  });

  it("fails closed when the RPC errors", async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    expect(await requireAgencyAdmin()).toBeNull();
  });

  it("fails closed on a non-boolean RPC payload", async () => {
    mockRpc.mockResolvedValue({ data: "yes", error: null });
    expect(await requireAgencyAdmin()).toBeNull();
  });
});
