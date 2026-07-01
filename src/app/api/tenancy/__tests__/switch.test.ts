import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetUser = vi.fn();
const mockMaybeSingle = vi.fn();
vi.mock("@/lib/tenancy", () => ({
  ACTIVE_WORKSPACE_COOKIE: "active_workspace",
  getUserScopedClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({ maybeSingle: mockMaybeSingle })),
      })),
    })),
  })),
}));

import { POST } from "../switch/route";

function req(body: unknown) {
  return new Request("http://test/api/tenancy/switch", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
  mockMaybeSingle.mockResolvedValue({ data: { id: "ws-demo" } });
});

describe("POST /api/tenancy/switch", () => {
  it("401s with no session", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    expect((await POST(req({ workspaceId: "ws-demo" }))).status).toBe(401);
  });
  it("400s on a missing workspaceId", async () => {
    expect((await POST(req({}))).status).toBe(400);
  });
  it("403s when the workspace is not visible to the user", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null });
    expect((await POST(req({ workspaceId: "ws-foreign" }))).status).toBe(403);
  });
  it("sets the cookie on success", async () => {
    const res = await POST(req({ workspaceId: "ws-demo" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toContain("active_workspace=ws-demo");
  });
});
