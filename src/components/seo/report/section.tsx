// src/components/seo/report/section.tsx
import { type ReactNode } from "react";

interface SectionProps {
  title: string;
  children: ReactNode;
}

export function Section({ title, children }: SectionProps) {
  return (
    <section className="mb-12">
      <h2 className="text-muted-foreground text-xs uppercase mb-3 font-semibold">
        {title}
      </h2>
      <div className="grid grid-cols-12 gap-3">{children}</div>
    </section>
  );
}
