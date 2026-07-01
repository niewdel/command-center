import { describe, it, expect, beforeAll, vi, afterEach } from "vitest";
import { NextRequest } from "next/server";

// Exercises the two portal photo API routes end-to-end at the route-handler
// level (no real Supabase — the service client is mocked) to prove the
// security model: every route re-verifies the view token, and every
// storage call is scoped to the server-verified `id` route param, never a
// client-supplied path.

const uploadMock = vi.fn();
const listMock = vi.fn();
const createSignedUrlMock = vi.fn();

vi.mock("@/lib/seo/db", () => ({
  getServiceClient: () => ({
    storage: {
      from: () => ({
        upload: uploadMock,
        list: listMock,
        createSignedUrl: createSignedUrlMock,
      }),
    },
  }),
}));

beforeAll(() => {
  process.env.SEO_REPORT_PRINT_SECRET = "test-secret-for-portal-upload-routes";
});

afterEach(() => {
  uploadMock.mockReset();
  listMock.mockReset();
  createSignedUrlMock.mockReset();
});

async function importSignToken() {
  const { signViewToken } = await import("@/lib/seo/report-print-token");
  return signViewToken;
}

describe("POST /api/portal/[id]/upload", () => {
  it("rejects a bad token with 401 and never calls storage", async () => {
    const { POST } = await import("../[id]/upload/route");

    const form = new FormData();
    form.set("token", "not-a-valid-token");
    form.set(
      "file",
      new File([new Uint8Array([1, 2, 3])], "photo.png", { type: "image/png" })
    );

    const req = new NextRequest("http://localhost/api/portal/client-123/upload", {
      method: "POST",
      body: form,
    });

    const res = await POST(req, { params: Promise.resolve({ id: "client-123" }) });
    expect(res.status).toBe(401);
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it("rejects a token signed for a different client (no cross-client access)", async () => {
    const signViewToken = await importSignToken();
    const { POST } = await import("../[id]/upload/route");

    const tokenForOtherClient = signViewToken("client-456");
    const form = new FormData();
    form.set("token", tokenForOtherClient);
    form.set(
      "file",
      new File([new Uint8Array([1, 2, 3])], "photo.png", { type: "image/png" })
    );

    const req = new NextRequest("http://localhost/api/portal/client-123/upload", {
      method: "POST",
      body: form,
    });

    const res = await POST(req, { params: Promise.resolve({ id: "client-123" }) });
    expect(res.status).toBe(401);
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it("uploads to a path scoped to the verified client id, ignoring any client-supplied path", async () => {
    uploadMock.mockResolvedValue({ error: null });
    listMock.mockResolvedValue({ data: [], error: null });
    const signViewToken = await importSignToken();
    const { POST } = await import("../[id]/upload/route");

    const token = signViewToken("client-123");
    const form = new FormData();
    form.set("token", token);
    // Even if a caller tried to smuggle a path/prefix field, the route
    // never reads one from the form — it only reads `file` and `token`.
    form.set("path", "client-456/hijacked.png");
    // Real PNG magic bytes so the post-parse magic-byte sniff passes —
    // the filename itself is still the traversal attempt under test.
    form.set(
      "file",
      new File(
        [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
        "../../evil.png",
        { type: "image/png" }
      )
    );

    const req = new NextRequest("http://localhost/api/portal/client-123/upload", {
      method: "POST",
      body: form,
    });

    const res = await POST(req, { params: Promise.resolve({ id: "client-123" }) });
    expect(res.status).toBe(200);
    expect(uploadMock).toHaveBeenCalledTimes(1);
    const [path] = uploadMock.mock.calls[0];
    expect(path.startsWith("client-123/")).toBe(true);
    expect(path).not.toContain("client-456");
    expect(path).not.toContain("..");
  });

  it("rejects a disallowed file type with 400 before ever touching storage", async () => {
    const signViewToken = await importSignToken();
    const { POST } = await import("../[id]/upload/route");

    const token = signViewToken("client-123");
    const form = new FormData();
    form.set("token", token);
    form.set(
      "file",
      new File([new Uint8Array([1, 2, 3])], "not-an-image.pdf", {
        type: "application/pdf",
      })
    );

    const req = new NextRequest("http://localhost/api/portal/client-123/upload", {
      method: "POST",
      body: form,
    });

    const res = await POST(req, { params: Promise.resolve({ id: "client-123" }) });
    expect(res.status).toBe(400);
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it("rejects an oversize file with 400 before ever touching storage", async () => {
    const signViewToken = await importSignToken();
    const { POST } = await import("../[id]/upload/route");

    const token = signViewToken("client-123");
    const big = new Uint8Array(10 * 1024 * 1024 + 1);
    const form = new FormData();
    form.set("token", token);
    form.set("file", new File([big], "huge.png", { type: "image/png" }));

    const req = new NextRequest("http://localhost/api/portal/client-123/upload", {
      method: "POST",
      body: form,
    });

    const res = await POST(req, { params: Promise.resolve({ id: "client-123" }) });
    expect(res.status).toBe(400);
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it("rejects a request with a spoofed oversize Content-Length header before parsing the body", async () => {
    const signViewToken = await importSignToken();
    const { POST } = await import("../[id]/upload/route");

    const token = signViewToken("client-123");
    const form = new FormData();
    form.set("token", token);
    form.set(
      "file",
      new File([new Uint8Array([1, 2, 3])], "tiny.png", { type: "image/png" })
    );

    const req = new NextRequest("http://localhost/api/portal/client-123/upload", {
      method: "POST",
      body: form,
      headers: { "content-length": String(10 * 1024 * 1024 + 1) },
    });

    const res = await POST(req, { params: Promise.resolve({ id: "client-123" }) });
    expect(res.status).toBe(413);
    expect(uploadMock).not.toHaveBeenCalled();
    expect(listMock).not.toHaveBeenCalled();
  });

  it("rejects uploads once the client is at the per-client file cap", async () => {
    listMock.mockResolvedValue({
      data: Array.from({ length: 100 }, (_, i) => ({
        id: String(i),
        name: `${i}.png`,
      })),
      error: null,
    });
    const signViewToken = await importSignToken();
    const { POST } = await import("../[id]/upload/route");

    const token = signViewToken("client-123");
    const form = new FormData();
    form.set("token", token);
    form.set(
      "file",
      new File(
        [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
        "photo.png",
        { type: "image/png" }
      )
    );

    const req = new NextRequest("http://localhost/api/portal/client-123/upload", {
      method: "POST",
      body: form,
    });

    const res = await POST(req, { params: Promise.resolve({ id: "client-123" }) });
    expect(res.status).toBe(429);
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it("rejects non-image bytes mislabeled with an image content type", async () => {
    listMock.mockResolvedValue({ data: [], error: null });
    const signViewToken = await importSignToken();
    const { POST } = await import("../[id]/upload/route");

    const token = signViewToken("client-123");
    const form = new FormData();
    form.set("token", token);
    form.set(
      "file",
      new File([new TextEncoder().encode("<html>not an image</html>")], "photo.png", {
        type: "image/png",
      })
    );

    const req = new NextRequest("http://localhost/api/portal/client-123/upload", {
      method: "POST",
      body: form,
    });

    const res = await POST(req, { params: Promise.resolve({ id: "client-123" }) });
    expect(res.status).toBe(415);
    expect(uploadMock).not.toHaveBeenCalled();
  });
});

describe("GET /api/portal/[id]/photos", () => {
  it("rejects a bad token with 401 and never calls storage", async () => {
    const { GET } = await import("../[id]/photos/route");

    const req = new NextRequest(
      "http://localhost/api/portal/client-123/photos?token=bad-token"
    );
    const res = await GET(req, { params: Promise.resolve({ id: "client-123" }) });
    expect(res.status).toBe(401);
    expect(listMock).not.toHaveBeenCalled();
  });

  it("rejects a token scoped to a different client", async () => {
    const signViewToken = await importSignToken();
    const { GET } = await import("../[id]/photos/route");

    const tokenForOtherClient = signViewToken("client-456");
    const req = new NextRequest(
      `http://localhost/api/portal/client-123/photos?token=${tokenForOtherClient}`
    );
    const res = await GET(req, { params: Promise.resolve({ id: "client-123" }) });
    expect(res.status).toBe(401);
    expect(listMock).not.toHaveBeenCalled();
  });

  it("lists only the verified client's folder and returns signed urls scoped to it", async () => {
    listMock.mockResolvedValue({
      data: [{ id: "abc", name: "1000-photo.png", created_at: null, metadata: {} }],
      error: null,
    });
    createSignedUrlMock.mockResolvedValue({
      data: { signedUrl: "https://signed.example/client-123/1000-photo.png" },
      error: null,
    });

    const signViewToken = await importSignToken();
    const { GET } = await import("../[id]/photos/route");

    const token = signViewToken("client-123");
    const req = new NextRequest(
      `http://localhost/api/portal/client-123/photos?token=${token}`
    );
    const res = await GET(req, { params: Promise.resolve({ id: "client-123" }) });
    expect(res.status).toBe(200);

    expect(listMock).toHaveBeenCalledWith(
      "client-123",
      expect.anything()
    );

    const body = await res.json();
    expect(body.photos).toHaveLength(1);
    expect(body.photos[0].path).toBe("client-123/1000-photo.png");
  });
});
