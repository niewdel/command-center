import type { RoadmapBlock } from "@/types/proposals";
import { BlockCard, BlockHeading, BlockShell } from "./shared";

export function RoadmapBlockView({ block }: { block: RoadmapBlock }) {
  return (
    <BlockShell>
      <BlockHeading>{block.heading}</BlockHeading>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {block.phases.map((phase, i) => (
          <BlockCard key={i}>
            <div className="report-label mb-2">{phase.label}</div>
            <p className="text-sm text-foreground text-pretty">{phase.body}</p>
          </BlockCard>
        ))}
      </div>
    </BlockShell>
  );
}
