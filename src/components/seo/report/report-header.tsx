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
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div className="space-y-2">
          <span className="mono-tag block">
            SEO Report · {data.client.period_label}
          </span>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-balance text-foreground">
            {data.client.name}
          </h1>
          {data.client.domain && (
            <div className="text-muted-foreground text-sm">
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
