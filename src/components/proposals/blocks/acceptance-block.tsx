import type { AcceptanceBlock } from "@/types/proposals";
import { BlockCard, BlockHeading, BlockShell } from "./shared";

/**
 * Display-only acceptance block. Renders the terms + a static signature
 * placeholder. The interactive acceptance panel (option toggles, consent
 * checkbox, typed signature, sign API call) is Task P5. This component is
 * intentionally non-interactive.
 */
export function AcceptanceBlockView({ block }: { block: AcceptanceBlock }) {
  return (
    <BlockShell>
      <BlockHeading>{block.heading}</BlockHeading>
      <p className="max-w-2xl text-sm text-foreground text-pretty leading-relaxed">{block.body}</p>
      <div className={`mt-6 grid grid-cols-1 gap-4 ${block.dual ? "sm:grid-cols-2" : "sm:grid-cols-1 max-w-sm"}`}>
        <BlockCard>
          <div className="report-label mb-3">Client signature</div>
          <div className="h-10 border-b border-border" />
          <p className="mt-2 text-xs text-muted-foreground">Name, date</p>
        </BlockCard>
        {block.dual && (
          <BlockCard>
            <div className="report-label mb-3">Niewdel signature</div>
            <div className="h-10 border-b border-border" />
            <p className="mt-2 text-xs text-muted-foreground">Name, date</p>
          </BlockCard>
        )}
      </div>
    </BlockShell>
  );
}
