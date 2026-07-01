import type { TimelineBlock } from "@/types/proposals";
import { BlockHeading, BlockShell } from "./shared";

export function TimelineBlockView({ block }: { block: TimelineBlock }) {
  return (
    <BlockShell>
      <BlockHeading>{block.heading}</BlockHeading>
      <p className="report-label mb-4">{block.totalDuration}</p>
      <ol className="space-y-4">
        {block.phases.map((phase, i) => (
          <li key={i} className="flex gap-4 border-l-2 border-[var(--rust)] pl-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-sm font-semibold text-foreground">{phase.label}</span>
                <span className="text-xs text-muted-foreground">{phase.duration}</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground text-pretty">{phase.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </BlockShell>
  );
}
