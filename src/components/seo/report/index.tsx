import type { ReportData } from "@/lib/seo/report-data";
import { ReportHeader } from "./report-header";
import { HealthSection } from "./health-section";
import { TrafficSection } from "./traffic-section";
import { KeywordsSection } from "./keywords-section";
import { TopPagesSection } from "./top-pages-section";
import { IssuesWinsSection } from "./issues-wins-section";
import { TrendsSection } from "./trends-section";
import { SummarySection } from "./summary-section";
import { ReportFooter } from "./report-footer";

interface Props {
  data: ReportData;
  mode?: "standalone" | "embedded";
}

export function ClientReport({ data, mode = "standalone" }: Props) {
  return (
    <div className="bg-background text-foreground">
      <ReportHeader data={data} mode={mode} />
      <HealthSection data={data} />
      <TrafficSection data={data} />
      <KeywordsSection data={data} />
      <TopPagesSection data={data} />
      <IssuesWinsSection data={data} />
      <TrendsSection data={data} />
      <SummarySection data={data} />
      <ReportFooter data={data} />
    </div>
  );
}
