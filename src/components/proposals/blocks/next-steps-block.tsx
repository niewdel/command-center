import type { NextStepsBlock } from "@/types/proposals";
import { BlockCard, BlockHeading, BlockShell } from "./shared";

export function NextStepsBlockView({ block }: { block: NextStepsBlock }) {
  return (
    <BlockShell>
      <BlockHeading>{block.heading}</BlockHeading>
      <BlockCard>
        <ol className="space-y-3">
          {block.steps.map((step, i) => (
            <li key={i} className="flex items-start gap-3 text-sm text-foreground">
              <span className="report-label mt-0.5 shrink-0">{String(i + 1).padStart(2, "0")}</span>
              <span className="text-pretty">{step}</span>
            </li>
          ))}
        </ol>
        <p className="mt-5 text-xs text-muted-foreground">{block.approvalWindow}</p>
      </BlockCard>
    </BlockShell>
  );
}
