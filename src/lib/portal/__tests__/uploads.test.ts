import { describe, it, expect } from "vitest";
import {
  MAX_UPLOAD_BYTES,
  MAX_FILES_PER_CLIENT,
  isAllowedImageType,
  validateUpload,
  sanitizeFilename,
  buildUploadPath,
  pathBelongsToClient,
  isOverFileCap,
  exceedsContentLength,
  sniffImageType,
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

describe("isOverFileCap", () => {
  it("allows uploads below the cap", () => {
    expect(isOverFileCap(0)).toBe(false);
    expect(isOverFileCap(MAX_FILES_PER_CLIENT - 1)).toBe(false);
  });

  it("blocks uploads at or over the cap", () => {
    expect(isOverFileCap(MAX_FILES_PER_CLIENT)).toBe(true);
    expect(isOverFileCap(MAX_FILES_PER_CLIENT + 1)).toBe(true);
  });
});

describe("exceedsContentLength", () => {
  it("allows a missing header (falls through to post-parse check)", () => {
    expect(exceedsContentLength(null)).toBe(false);
  });

  it("allows a header within the max size", () => {
    expect(exceedsContentLength(String(MAX_UPLOAD_BYTES))).toBe(false);
  });

  it("rejects a header over the max size", () => {
    expect(exceedsContentLength(String(MAX_UPLOAD_BYTES + 1))).toBe(true);
  });

  it("ignores a garbage/non-numeric header", () => {
    expect(exceedsContentLength("not-a-number")).toBe(false);
  });
});

describe("sniffImageType", () => {
  it("recognizes a PNG signature", () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(sniffImageType(bytes)).toBe("image/png");
  });

  it("recognizes a JPEG signature", () => {
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    expect(sniffImageType(bytes)).toBe("image/jpeg");
  });

  it("recognizes a GIF signature", () => {
    const bytes = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
    expect(sniffImageType(bytes)).toBe("image/gif");
  });

  it("recognizes a WebP signature", () => {
    const bytes = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
    ]);
    expect(sniffImageType(bytes)).toBe("image/webp");
  });

  it("returns null for HTML bytes mislabeled as an image", () => {
    const bytes = new TextEncoder().encode("<html><body>hi</body></html>");
    expect(sniffImageType(bytes)).toBeNull();
  });

  it("returns null for plain text bytes", () => {
    const bytes = new TextEncoder().encode("just some plain text");
    expect(sniffImageType(bytes)).toBeNull();
  });

  it("returns null for truncated/empty bytes", () => {
    expect(sniffImageType(new Uint8Array([]))).toBeNull();
    expect(sniffImageType(new Uint8Array([0x89, 0x50]))).toBeNull();
  });

  it("recognizes an iPhone HEIC signature (ftyp + heic brand)", () => {
    // bytes 0-3 box size, 4-7 "ftyp", 8-11 major brand "heic"
    const bytes = new Uint8Array([
      0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63,
    ]);
    expect(sniffImageType(bytes)).toBe("image/heic");
  });

  it("recognizes a HEIF signature (ftyp + mif1 brand)", () => {
    const bytes = new Uint8Array([
      0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x69, 0x66, 0x31,
    ]);
    expect(sniffImageType(bytes)).toBe("image/heif");
  });

  it("returns null for an ftyp box with a non-image brand (e.g. mp4)", () => {
    // "ftyp" + "isom" (an MP4 brand) must not pass as an image
    const bytes = new Uint8Array([
      0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d,
    ]);
    expect(sniffImageType(bytes)).toBeNull();
  });
});
