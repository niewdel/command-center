import type { CrmProposalLineItem, TwoPathsBlock } from "@/types/proposals";
import { formatCents, nMonthTotal } from "@/lib/proposals/pricing";
import { BlockCard, BlockHeading, BlockShell } from "./shared";

interface Props {
  block: TwoPathsBlock;
}

/** A synthetic, fully-typed line item used only to drive nMonthTotal's math. */
function syntheticItem(
  overrides: Pick<CrmProposalLineItem, "kind" | "amount_cents" | "cadence" | "label">
): CrmProposalLineItem {
  return {
    id: "",
    workspace_id: "",
    proposal_id: "",
    description: null,
    badge: null,
    recurring_months: null,
    option_group: null,
    is_optional: false,
    is_selected: true,
    position: 0,
    created_at: "",
    ...overrides,
  };
}

/** Month markers shown in the totals table, capped at the block's own term. */
function monthMarkers(months: number): number[] {
  const candidates = [1, 3, 6, 12, 24];
  const markers = candidates.filter((m) => m <= months);
  if (markers[markers.length - 1] !== months) markers.push(months);
  return markers;
}

export function TwoPathsBlockView({ block }: Props) {
  const managedItem = [
    syntheticItem({ kind: "recurring", amount_cents: block.managedMonthlyCents, cadence: "per_month", label: block.managedLabel }),
  ];
  const ownItItem = [
    syntheticItem({ kind: "handoff", amount_cents: block.ownItOneTimeCents, cadence: "at_handoff", label: block.ownItLabel }),
  ];
  const markers = monthMarkers(block.months);

  return (
    <BlockShell>
      <BlockHeading>{block.heading}</BlockHeading>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <BlockCard>
          <div className="report-label mb-2">{block.managedLabel}</div>
          <p className="text-sm text-foreground text-pretty">{block.managedBody}</p>
        </BlockCard>
        <BlockCard>
          <div className="report-label mb-2">{block.ownItLabel}</div>
          <p className="text-sm text-foreground text-pretty">{block.ownItBody}</p>
        </BlockCard>
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="report-label py-2 pr-4 font-normal">Path</th>
              {markers.map((m) => (
                <th key={m} className="report-label py-2 pr-4 font-normal text-right">
                  {m} mo{m === 1 ? "" : "s"}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border">
              <td className="py-3 pr-4 font-semibold text-foreground">{block.managedLabel}</td>
              {markers.map((m) => (
                <td key={m} className="py-3 pr-4 text-right font-data tabular-nums text-foreground">
                  {formatCents(nMonthTotal(managedItem, m))}
                </td>
              ))}
            </tr>
            <tr>
              <td className="py-3 pr-4 font-semibold text-foreground">{block.ownItLabel}</td>
              {markers.map((m) => (
                <td key={m} className="py-3 pr-4 text-right font-data tabular-nums text-foreground">
                  {formatCents(nMonthTotal(ownItItem, m))}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </BlockShell>
  );
}
