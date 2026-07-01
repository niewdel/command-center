import type { PaymentTermsBlock } from "@/types/proposals";
import { BlockHeading, BlockShell } from "./shared";

export function PaymentTermsBlockView({ block }: { block: PaymentTermsBlock }) {
  return (
    <BlockShell>
      <BlockHeading>{block.heading}</BlockHeading>
      <p className="max-w-2xl text-sm text-foreground text-pretty leading-relaxed">{block.body}</p>
    </BlockShell>
  );
}
