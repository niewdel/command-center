import { describe, it, expect } from "vitest";
import {
  MAX_UPLOAD_BYTES,
  isAllowedImageType,
  validateUpload,
  sanitizeFilename,
  buildUploadPath,
  pathBelongsToClient,
} from "../uploads";

describe("isAllowedImageType", () => {
  it("accepts common image mime types", () => {
    expect(isAllowedImageType("image/jpeg")).toBe(true);
    expect(isAllowedImageType("image/png")).toBe(true);
    expect(isAllowedImageType("image/webp")).toBe(true);
    expect(isAllowedImageType("image/heic")).toBe(true);
    expect(isAllowedImageType("image/gif")).toBe(true);
  });

  it("rejects non-image types", () => {
    expect(isAllowedImageType("application/pdf")).toBe(false);
    expect(isAllowedImageType("text/html")).toBe(false);
    expect(isAllowedImageType("application/javascript")).toBe(false);
  });
});

describe("validateUpload", () => {
  it("passes a valid small image", () => {
    expect(validateUpload({ contentType: "image/png", size: 1024 })).toEqual({
      ok: true,
    });
  });

  it("rejects a disallowed content type", () => {
    const result = validateUpload({ contentType: "application/pdf", size: 1024 });
    expect(result.ok).toBe(false);
  });

  it("rejects a file over the size limit", () => {
    const result = validateUpload({
      contentType: "image/png",
      size: MAX_UPLOAD_BYTES + 1,
    });
    expect(result.ok).toBe(false);
  });

  it("accepts a file exactly at the size limit", () => {
    const result = validateUpload({
      contentType: "image/png",
      size: MAX_UPLOAD_BYTES,
    });
    expect(result.ok).toBe(true);
  });

  it("rejects an empty file", () => {
    const result = validateUpload({ contentType: "image/png", size: 0 });
    expect(result.ok).toBe(false);
  });
});

describe("sanitizeFilename", () => {
  it("strips path separators to prevent directory traversal", () => {
    expect(sanitizeFilename("../../etc/passwd")).not.toContain("/");
    expect(sanitizeFilename("../../etc/passwd")).not.toContain("..");
  });

  it("strips windows-style separators too", () => {
    const result = sanitizeFilename("..\\..\\windows\\system32\\evil.png");
    expect(result).not.toContain("\\");
    expect(result).not.toContain("/");
  });

  it("keeps a normal filename intact (aside from safe charset)", () => {
    expect(sanitizeFilename("beach-photo.jpg")).toBe("beach-photo.jpg");
  });

  it("falls back to a generic name when nothing sane remains", () => {
    expect(sanitizeFilename("../../")).toBe("photo");
  });
});

describe("buildUploadPath", () => {
  it("always scopes the path under the given clientId", () => {
    const path = buildUploadPath("client-123", "photo.png", "image/png", 1000);
    expect(path.startsWith("client-123/")).toBe(true);
    expect(path).toBe("client-123/1000-photo.png");
  });

  it("cannot be escaped via a malicious filename", () => {
    const path = buildUploadPath(
      "client-123",
      "../../other-client/secret.png",
      "image/png",
      1000
    );
    expect(path.startsWith("client-123/")).toBe(true);
    // No traversal segments anywhere in the resulting path.
    expect(path).not.toContain("..");
    // And it can never contain a second client folder segment.
    expect(path.split("/")).toHaveLength(2);
  });

  it("adds an extension inferred from content-type when filename has none", () => {
    const path = buildUploadPath("client-123", "photo", "image/png", 1000);
    expect(path).toBe("client-123/1000-photo.png");
  });
});

describe("pathBelongsToClient", () => {
  it("accepts paths under the client's own folder", () => {
    expect(pathBelongsToClient("client-123/1000-a.png", "client-123")).toBe(true);
  });

  it("rejects paths under a different client's folder", () => {
    expect(pathBelongsToClient("client-456/1000-a.png", "client-123")).toBe(false);
  });

  it("rejects a prefix-similar but distinct client id", () => {
    expect(pathBelongsToClient("client-1234/1000-a.png", "client-123")).toBe(false);
  });
});
