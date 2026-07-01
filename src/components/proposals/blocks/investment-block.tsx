import type { CrmProposalLineItem, InvestmentBlock } from "@/types/proposals";
import { LINE_ITEM_CADENCE_LABEL } from "@/types/proposals";
import { computeTotals, formatCents, resolveSelectedItems } from "@/lib/proposals/pricing";
import { Badge } from "@/components/ui/badge";
import { BlockCard, BlockHeading, BlockShell } from "./shared";

interface Props {
  block: InvestmentBlock;
  lineItems: CrmProposalLineItem[];
}

/**
 * Investment block: a vertical line-item stack (label + optional pill badge
 * + description + right-aligned formatted amount + caps cadence label),
 * followed by a totals summary. Renders from the relational line items via
 * the P1 pricing engine, never from inline numbers.
 */
export function InvestmentBlockView({ block, lineItems }: Props) {
  const resolved = resolveSelectedItems(lineItems).sort((a, b) => a.position - b.position);
  const totals = computeTotals(lineItems);

  return (
    <BlockShell>
      <BlockHeading>{block.heading}</BlockHeading>
      {block.note && <p className="mb-5 max-w-2xl text-sm text-muted-foreground text-pretty">{block.note}</p>}
      <BlockCard className="p-0">
        <ul className="divide-y divide-border">
          {resolved.map((item) => (
            <li key={item.id || item.label} className="flex items-start justify-between gap-4 p-5">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">{item.label}</span>
                  {item.badge && (
                    <Badge variant="secondary" className="uppercase tracking-wide">
                      {item.badge}
                    </Badge>
                  )}
                </div>
                {item.description && (
                  <p className="mt-1 text-sm text-muted-foreground text-pretty">{item.description}</p>
                )}
              </div>
              <div className="shrink-0 text-right">
                <div className="text-sm font-semibold text-foreground font-data tabular-nums">
                  {formatCents(item.amount_cents)}
                </div>
                <div className="report-label mt-1">{LINE_ITEM_CADENCE_LABEL[item.cadence].toUpperCase()}</div>
              </div>
            </li>
          ))}
        </ul>
      </BlockCard>

      <dl className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <dt className="report-label">One-time subtotal</dt>
          <dd className="mt-1 text-lg font-semibold text-foreground font-data tabular-nums">
            {formatCents(totals.oneTimeCents)}
          </dd>
        </div>
        <div>
          <dt className="report-label">Recurring monthly</dt>
          <dd className="mt-1 text-lg font-semibold text-foreground font-data tabular-nums">
            {formatCents(totals.recurringMonthlyCents)}
          </dd>
        </div>
        <div>
          <dt className="report-label">Deposit due at signature</dt>
          <dd className="mt-1 text-lg font-semibold text-foreground font-data tabular-nums">
            {formatCents(totals.depositCents)}
          </dd>
        </div>
      </dl>
    </BlockShell>
  );
}
