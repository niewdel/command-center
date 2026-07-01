// src/components/proposals/blocks/shared.tsx
//
// Shared presentational primitives for the proposal block renderer (Task P3).
// Pure, no data fetching, no client hooks. Matches the brand-v3 report
// utility classes already in globals.css (.report-eyebrow / .report-rule)
// and the sm6/md9/lg12/pill40 radius scale + blue-dot bullets from the
// brand v3 reference.

import type { ReactNode } from "react";

export function BlockHeading({ children }: { children: ReactNode }) {
  return (
    <div className="mb-5">
      <h2 className="report-eyebrow">{children}</h2>
      <span className="report-rule mt-2" />
    </div>
  );
}

export function BlockShell({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`mb-12 ${className}`}>{children}</section>;
}

export function BlueDotList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2.5">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-3 text-sm text-foreground">
          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[var(--rust)]" />
          <span className="text-pretty">{item}</span>
        </li>
      ))}
    </ul>
  );
}

/** Onyx card, hairline border, md radius. Used across every block body. */
export function BlockCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`report-card p-6 ${className}`}>{children}</div>;
}
