import type { ReportData } from "@/lib/seo/report-data";
import { Section } from "./section";

export function SummarySection({ data }: { data: ReportData }) {
  if (!data.ai_summary) return null;
  return (
    <Section title="From the Niewdel team">
      <div className="col-span-12 report-card p-6">
        <p className="text-pretty leading-relaxed">{data.ai_summary}</p>
      </div>
    </Section>
  );
}
