import type { ReportData } from "@/lib/seo/report-types";
import { RANGE_LABEL } from "@/lib/seo/report-types";

export function ReportFooter({ data }: { data: ReportData }) {
  const generated = new Date(data.client.generated_at).toLocaleDateString(
    "en-US",
    { month: "short", day: "numeric", year: "numeric" }
  );
  return (
    <footer className="mt-16 pt-6 border-t border-border text-muted-foreground text-xs flex justify-between flex-wrap gap-2">
      <div>Delivered by Niewdel · {generated}</div>
      <div>{RANGE_LABEL[data.range]}</div>
    </footer>
  );
}
