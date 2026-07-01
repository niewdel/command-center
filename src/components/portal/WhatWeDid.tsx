// src/components/portal/WhatWeDid.tsx
//
// "What we've done for you" — resolved-issues changelog so the client
// sees Niewdel actively working, not just a static score. Blue-dot
// bullets per brand v3 (not default discs, not the operator report's
// green checkmarks — this is its own client-facing surface).

import type { ReportData } from "@/lib/seo/report-types";

export function WhatWeDid({ data }: { data: ReportData }) {
  const resolved = data.issues.resolved;

  return (
    <section>
      <div className="mb-5">
        <h2 className="report-eyebrow">What We&apos;ve Done For You</h2>
        <span className="report-rule mt-2" />
      </div>

      {resolved.length > 0 ? (
        <div className="report-card p-6">
          <ul className="space-y-3">
            {resolved.map((r, i) => (
              <li
                key={`${r.title}-${i}`}
                className="flex items-start gap-3 text-sm text-foreground"
              >
                <span className="mt-1.5 size-1.5 rounded-full bg-[var(--rust)] shrink-0" />
                <span className="text-pretty">{r.title}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="report-card p-6 border-dashed">
          <p className="text-base font-bold text-foreground tracking-tight mb-2">
            We&apos;re just getting started.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-[60ch]">
            As we find and fix things on your site, you&apos;ll see the work
            show up here.
          </p>
        </div>
      )}
    </section>
  );
}
