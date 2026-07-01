import type { LiabilityBlock } from "@/types/proposals";
import { BlockCard, BlockHeading, BlockShell, BlueDotList } from "./shared";

export function LiabilityBlockView({ block }: { block: LiabilityBlock }) {
  return (
    <BlockShell>
      <BlockHeading>{block.heading}</BlockHeading>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <BlockCard>
          <div className="report-label mb-3">Niewdel is responsible for</div>
          <BlueDotList items={block.responsible} />
        </BlockCard>
        <BlockCard>
          <div className="report-label mb-3">Niewdel is not responsible for</div>
          <BlueDotList items={block.notResponsible} />
        </BlockCard>
      </div>
      <p className="mt-4 text-sm text-muted-foreground">{block.liabilityCap}</p>
      <div className="mt-5">
        <div className="report-label mb-3">Client obligations</div>
        <BlueDotList items={block.clientObligations} />
      </div>
    </BlockShell>
  );
}
