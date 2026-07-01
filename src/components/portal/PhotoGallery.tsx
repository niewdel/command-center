"use client";

// src/components/portal/PhotoGallery.tsx
//
// Responsive grid of a client's uploaded photos, fetched from
// /api/portal/[id]/photos (token-verified, signed URLs scoped to that
// client's folder only). Simple click-to-enlarge lightbox.

import { useCallback, useEffect, useState } from "react";
import { ImageIcon, X } from "lucide-react";

interface Photo {
  name: string;
  path: string;
  url: string;
  createdAt: string | null;
  size: number | null;
}

interface PhotoGalleryProps {
  clientId: string;
  token: string;
  refreshKey?: number;
}

export function PhotoGallery({ clientId, token, refreshKey }: PhotoGalleryProps) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<Photo | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/portal/${clientId}/photos?token=${encodeURIComponent(token)}`
      );
      if (!res.ok) throw new Error("Failed to load photos.");
      const payload = await res.json();
      setPhotos(Array.isArray(payload.photos) ? payload.photos : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load photos.");
    } finally {
      setLoading(false);
    }
  }, [clientId, token]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="aspect-square rounded-md bg-muted animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="report-card border-dashed p-6 text-center">
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  if (photos.length === 0) {
    return (
      <div className="report-card border-dashed p-8 text-center">
        <ImageIcon
          className="size-8 mx-auto mb-3 text-muted-foreground"
          aria-hidden="true"
        />
        <p className="text-sm font-semibold text-foreground mb-1">
          No photos yet.
        </p>
        <p className="text-xs text-muted-foreground max-w-[40ch] mx-auto">
          Upload photos for your campaigns and ads and they&apos;ll show up
          here.
        </p>
      </div>
    );
  }

  return (
    <>
      <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {photos.map((p) => (
          <li key={p.path}>
            <button
              type="button"
              aria-label={`Enlarge ${p.name}`}
              onClick={() => setLightbox(p)}
              className="block w-full aspect-square rounded-md overflow-hidden bg-muted"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.url}
                alt={p.name}
                className="size-full object-cover transition-transform hover:scale-105"
              />
            </button>
          </li>
        ))}
      </ul>

      {lightbox && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={lightbox.name}
          className="fixed inset-0 z-40 bg-black/80 flex items-center justify-center p-6"
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            aria-label="Close"
            className="absolute top-4 right-4 text-white/80 hover:text-white"
            onClick={() => setLightbox(null)}
          >
            <X className="size-6" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox.url}
            alt={lightbox.name}
            className="max-h-full max-w-full rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
