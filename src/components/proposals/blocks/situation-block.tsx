import type { SituationBlock } from "@/types/proposals";
import { BlockHeading, BlockShell } from "./shared";

export function SituationBlockView({ block }: { block: SituationBlock }) {
  return (
    <BlockShell>
      <BlockHeading>{block.heading}</BlockHeading>
      <p className="max-w-2xl text-pretty text-sm text-foreground leading-relaxed">{block.body}</p>
    </BlockShell>
  );
}
