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
    <header className="mb-12">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logos/niewdel-wordmark.png"
        alt="Niewdel"
        className="h-7 w-auto mb-8 opacity-90"
      />
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <span className="report-eyebrow block">
            Visibility Report · {data.client.period_label}
          </span>
          <h1 className="mt-3 text-3xl md:text-4xl font-bold tracking-tight text-balance text-foreground">
            {data.client.name}
            <span className="text-[var(--rust)]">.</span>
          </h1>
          <span className="report-rule mt-3" />
          {data.client.domain && (
            <div className="text-muted-foreground text-sm mt-3">
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
