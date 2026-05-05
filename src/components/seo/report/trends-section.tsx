import type { ReportData } from "@/lib/seo/report-data";
import { Section } from "./section";
import { ScoreHistoryChart } from "@/components/seo/score-history-chart";

export function TrendsSection({ data }: { data: ReportData }) {
  if (data.history.length < 2) return null;
  return (
    <Section title="Score Trends">
      <div className="col-span-12 bg-card border border-border rounded-lg p-6">
        <ScoreHistoryChart points={data.history} />
      </div>
    </Section>
  );
}
