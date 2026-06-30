// src/components/seo/report/section.tsx
import { type ReactNode } from "react";

interface SectionProps {
  title: string;
  children: ReactNode;
}

export function Section({ title, children }: SectionProps) {
  return (
    <section className="mb-14">
      <div className="mb-5">
        <h2 className="report-eyebrow">{title}</h2>
        <span className="report-rule mt-2" />
      </div>
      <div className="grid grid-cols-12 gap-3">{children}</div>
    </section>
  );
}
