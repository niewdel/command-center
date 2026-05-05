import type { ReportData } from "@/lib/seo/report-data";
import { RangeTabs } from "./range-tabs";

interface Props {
  data: ReportData;
  mode: "standalone" | "embedded";
}

export function ReportHeader({ data, mode }: Props) {
  const generated = new Date(data.client.generated_at).toLocaleDateString(
    "en-US",
    { month: "short", day: "numeric", year: "numeric" }
  );
  return (
    <header className="mb-10">
      <div className="flex items-start justify-between gap-6 flex-wrap">
        <div>
          <div className="text-muted-foreground text-xs uppercase font-semibold mb-2">
            SEO Report
          </div>
          <h1 className="text-4xl font-semibold text-balance">{data.client.name}</h1>
          {data.client.domain && (
            <div className="text-muted-foreground text-sm mt-1">
              {data.client.domain}
            </div>
          )}
        </div>
        {mode === "standalone" && (
          <div className="flex flex-col items-end gap-2">
            <RangeTabs active={data.range} />
            <div className="text-muted-foreground text-xs">
              Generated {generated}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
