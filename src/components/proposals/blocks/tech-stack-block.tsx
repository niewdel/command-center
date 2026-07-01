import type { TechStackBlock } from "@/types/proposals";
import { BlockHeading, BlockShell } from "./shared";

export function TechStackBlockView({ block }: { block: TechStackBlock }) {
  return (
    <BlockShell>
      <BlockHeading>{block.heading}</BlockHeading>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="report-label py-2 pr-4 font-normal">Tool</th>
              <th className="report-label py-2 pr-4 font-normal">Purpose</th>
              <th className="report-label py-2 font-normal">Cost</th>
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, i) => (
              <tr key={i} className="border-b border-border last:border-0">
                <td className="py-3 pr-4 font-semibold text-foreground">{row.tool}</td>
                <td className="py-3 pr-4 text-muted-foreground">{row.purpose}</td>
                <td className="py-3 text-muted-foreground">{row.costNote}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </BlockShell>
  );
}
