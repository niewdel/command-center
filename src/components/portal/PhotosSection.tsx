"use client";

// src/components/portal/PhotosSection.tsx
//
// Wires PhotoUploader + PhotoGallery together: bumps a refresh key after
// a successful upload so the gallery re-fetches. Kept as its own client
// component so the server-rendered portal page just passes down the
// already-verified token.

import { useState } from "react";
import { PhotoUploader } from "./PhotoUploader";
import { PhotoGallery } from "./PhotoGallery";

interface PhotosSectionProps {
  clientId: string;
  token: string;
}

export function PhotosSection({ clientId, token }: PhotosSectionProps) {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <section>
      <div className="mb-5">
        <h2 className="report-eyebrow">Photos</h2>
        <span className="report-rule mt-2" />
        <p className="text-sm text-muted-foreground mt-3 max-w-[60ch]">
          Upload photos for your campaigns and ads. We&apos;ll use these to
          keep your creative fresh.
        </p>
      </div>

      <div className="space-y-6">
        <PhotoUploader
          clientId={clientId}
          token={token}
          onUploaded={() => setRefreshKey((k) => k + 1)}
        />
        <PhotoGallery clientId={clientId} token={token} refreshKey={refreshKey} />
      </div>
    </section>
  );
}
