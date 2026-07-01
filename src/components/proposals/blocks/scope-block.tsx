import type { ScopeBlock } from "@/types/proposals";
import { BlockCard, BlockHeading, BlockShell } from "./shared";

export function ScopeBlockView({ block }: { block: ScopeBlock }) {
  return (
    <BlockShell>
      <BlockHeading>{block.heading}</BlockHeading>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {block.rows.map((row, i) => (
          <BlockCard key={i}>
            <div className="report-label mb-2">{row.capability}</div>
            <p className="text-sm text-foreground text-pretty">{row.whatYouGet}</p>
          </BlockCard>
        ))}
      </div>
    </BlockShell>
  );
}
