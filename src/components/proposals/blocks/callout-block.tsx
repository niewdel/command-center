import type { CalloutBlock } from "@/types/proposals";

const TONE_CLASSES: Record<CalloutBlock["tone"], string> = {
  info: "border-[var(--rust)]/40 bg-[var(--rust-tint)]",
  warn: "border-[#B8841A]/40 bg-[#B8841A]/10",
  trust: "border-border bg-card",
};

export function CalloutBlockView({ block }: { block: CalloutBlock }) {
  return (
    <section className="mb-12">
      <div className={`rounded-[9px] border p-5 text-sm text-foreground text-pretty ${TONE_CLASSES[block.tone]}`}>
        {block.body}
      </div>
    </section>
  );
}
