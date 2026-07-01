import type { RecurringPlanBlock } from "@/types/proposals";
import { formatCents } from "@/lib/proposals/pricing";
import { BlockCard, BlockHeading, BlockShell, BlueDotList } from "./shared";

export function RecurringPlanBlockView({ block }: { block: RecurringPlanBlock }) {
  return (
    <BlockShell>
      <BlockHeading>{block.heading}</BlockHeading>
      <BlockCard>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div className="report-label">{block.planName}</div>
          <div className="text-2xl font-semibold text-foreground font-data tabular-nums">
            {formatCents(block.monthlyCents)}
            <span className="ml-1 text-sm font-normal text-muted-foreground">/mo</span>
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{block.cadenceNote}</p>
        <div className="mt-5">
          <BlueDotList items={block.features} />
        </div>
      </BlockCard>
    </BlockShell>
  );
}
