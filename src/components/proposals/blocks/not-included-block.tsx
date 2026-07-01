import type { NotIncludedBlock } from "@/types/proposals";
import { BlockCard, BlockHeading, BlockShell, BlueDotList } from "./shared";

export function NotIncludedBlockView({ block }: { block: NotIncludedBlock }) {
  return (
    <BlockShell>
      <BlockHeading>{block.heading}</BlockHeading>
      <BlockCard>
        <BlueDotList items={block.items} />
      </BlockCard>
    </BlockShell>
  );
}
