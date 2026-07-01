"use client";

// src/components/portal/PhotoUploader.tsx
//
// Drag/drop + file-picker uploader for the customer portal's photo
// gallery. Client-side type/size checks are a UX nicety only — the
// server route (/api/portal/[id]/upload) is the authoritative gate and
// re-validates everything against the caller's verified view token.

import { useCallback, useRef, useState } from "react";
import { UploadCloud, ImageOff, CheckCircle2, Loader2 } from "lucide-react";
import { MAX_UPLOAD_BYTES, isAllowedImageType } from "@/lib/portal/uploads";

interface PhotoUploaderProps {
  clientId: string;
  token: string;
  onUploaded?: () => void;
}

type FileState = {
  id: string;
  file: File;
  previewUrl: string;
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
};

function fmtSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function guardFile(file: File): string | null {
  if (!isAllowedImageType(file.type)) {
    return "Unsupported file type. Use JPEG, PNG, WEBP, HEIC, or GIF.";
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return "File is too large. Max size is 10MB.";
  }
  return null;
}

export function PhotoUploader({ clientId, token, onUploaded }: PhotoUploaderProps) {
  const [files, setFiles] = useState<FileState[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadOne = useCallback(
    async (entry: FileState) => {
      setFiles((prev) =>
        prev.map((f) => (f.id === entry.id ? { ...f, status: "uploading" } : f))
      );

      try {
        const body = new FormData();
        body.set("file", entry.file);
        body.set("token", token);

        const res = await fetch(`/api/portal/${clientId}/upload`, {
          method: "POST",
          body,
        });

        if (!res.ok) {
          const payload = await res.json().catch(() => null);
          throw new Error(payload?.error || "Upload failed.");
        }

        setFiles((prev) =>
          prev.map((f) => (f.id === entry.id ? { ...f, status: "done" } : f))
        );
        onUploaded?.();
      } catch (err) {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === entry.id
              ? {
                  ...f,
                  status: "error",
                  error: err instanceof Error ? err.message : "Upload failed.",
                }
              : f
          )
        );
      }
    },
    [clientId, token, onUploaded]
  );

  const addFiles = useCallback(
    (list: FileList | null) => {
      if (!list || list.length === 0) return;
      const next: FileState[] = Array.from(list).map((file) => {
        const error = guardFile(file);
        return {
          id: `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          file,
          previewUrl: URL.createObjectURL(file),
          status: error ? "error" : "pending",
          error: error ?? undefined,
        };
      });
      setFiles((prev) => [...next, ...prev]);
      next.filter((f) => f.status === "pending").forEach((f) => uploadOne(f));
    },
    [uploadOne]
  );

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload photos"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          addFiles(e.dataTransfer.files);
        }}
        className={`report-card border-dashed p-8 text-center cursor-pointer transition-colors ${
          dragOver ? "border-[var(--rust)] bg-[var(--rust)]/5" : ""
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/gif"
          multiple
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <UploadCloud
          className="size-8 mx-auto mb-3 text-muted-foreground"
          aria-hidden="true"
        />
        <p className="text-sm font-semibold text-foreground mb-1">
          Drag photos here or click to upload
        </p>
        <p className="text-xs text-muted-foreground">
          JPEG, PNG, WEBP, HEIC, or GIF. Up to 10MB each.
        </p>
      </div>

      {files.length > 0 && (
        <ul className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {files.map((f) => (
            <li
              key={f.id}
              className="report-card p-2 flex flex-col gap-2"
              data-testid="upload-item"
            >
              <div className="relative aspect-square rounded-md overflow-hidden bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={f.previewUrl}
                  alt={f.file.name}
                  className="size-full object-cover"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                  {f.status === "uploading" && (
                    <Loader2
                      className="size-5 text-white animate-spin"
                      aria-label="Uploading"
                    />
                  )}
                  {f.status === "done" && (
                    <CheckCircle2
                      className="size-6 text-white"
                      aria-label="Uploaded"
                    />
                  )}
                  {f.status === "error" && (
                    <ImageOff className="size-6 text-white" aria-label="Failed" />
                  )}
                </div>
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {f.file.name} · {fmtSize(f.file.size)}
              </div>
              {f.status === "error" && f.error && (
                <div className="text-xs text-[var(--error,#C0413A)]">{f.error}</div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
