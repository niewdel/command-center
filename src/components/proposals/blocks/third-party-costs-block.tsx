import type { ThirdPartyCostsBlock } from "@/types/proposals";
import { formatCents } from "@/lib/proposals/pricing";
import { BlockHeading, BlockShell } from "./shared";

export function ThirdPartyCostsBlockView({ block }: { block: ThirdPartyCostsBlock }) {
  return (
    <BlockShell>
      <BlockHeading>{block.heading}</BlockHeading>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="report-label py-2 pr-4 font-normal">Item</th>
              <th className="report-label py-2 pr-4 font-normal">Cadence</th>
              <th className="report-label py-2 font-normal text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, i) => (
              <tr key={i} className="border-b border-border last:border-0">
                <td className="py-3 pr-4 font-semibold text-foreground">{row.item}</td>
                <td className="py-3 pr-4 text-muted-foreground">{row.cadence}</td>
                <td className="py-3 text-right font-data tabular-nums text-foreground">
                  {formatCents(row.amountCents)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </BlockShell>
  );
}
