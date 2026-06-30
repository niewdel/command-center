import type { ReportData } from "@/lib/seo/report-types";
import { RANGE_LABEL } from "@/lib/seo/report-types";

export function ReportFooter({ data }: { data: ReportData }) {
  const generated = new Date(data.client.generated_at).toLocaleDateString(
    "en-US",
    { month: "short", day: "numeric", year: "numeric" }
  );
  return (
    <footer className="mt-16 pt-6 border-t border-border text-muted-foreground text-xs flex justify-between items-center flex-wrap gap-2">
      <div className="inline-flex items-center gap-2">
        <span className="size-1.5 rounded-full bg-[var(--rust)]" />
        Delivered by Niewdel · {generated}
      </div>
      <div>{RANGE_LABEL[data.range]}</div>
    </footer>
  );
}
