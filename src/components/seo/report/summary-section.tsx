import type { ReportData } from "@/lib/seo/report-data";
import { Section } from "./section";

export function SummarySection({ data }: { data: ReportData }) {
  if (!data.ai_summary) return null;
  return (
    <Section title="What This Means">
      <div className="col-span-12 bg-card border border-border rounded-lg p-6">
        <p className="text-pretty leading-relaxed">{data.ai_summary}</p>
      </div>
    </Section>
  );
}
