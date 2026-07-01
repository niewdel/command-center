"use client";

// One small typed editor per block type (Task P4), selected via a
// discriminated switch on `block.type`. Each form receives the current
// block and an `onChange` that replaces it wholesale, so the parent
// (block-editor.tsx) can just splice the returned block back into the
// content array.

import type { ProposalBlock } from "@/types/proposals";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  NumberCentsField,
  RepeatingRowsField,
  StringListField,
  TextAreaField,
  TextField,
} from "./field";

export function BlockForm({
  block,
  onChange,
}: {
  block: ProposalBlock;
  onChange: (next: ProposalBlock) => void;
}) {
  switch (block.type) {
    case "cover":
      return (
        <div className="space-y-3">
          <TextField label="Kicker" value={block.kicker} onChange={(v) => onChange({ ...block, kicker: v })} />
          <TextField
            label="Headline"
            value={block.headline}
            withSnippets
            onChange={(v) => onChange({ ...block, headline: v })}
          />
          <TextAreaField
            label="Intro"
            value={block.intro}
            withSnippets
            onChange={(v) => onChange({ ...block, intro: v })}
          />
          <div className="grid grid-cols-2 gap-2">
            <TextField label="Prepared for" value={block.preparedFor} onChange={(v) => onChange({ ...block, preparedFor: v })} />
            <TextField label="Prepared by" value={block.preparedBy} onChange={(v) => onChange({ ...block, preparedBy: v })} />
          </div>
          <TextField label="Validity date" value={block.validityDate} onChange={(v) => onChange({ ...block, validityDate: v })} />
        </div>
      );

    case "situation":
      return (
        <div className="space-y-3">
          <TextField label="Heading" value={block.heading} onChange={(v) => onChange({ ...block, heading: v })} />
          <TextAreaField
            label="Body"
            value={block.body}
            rows={4}
            withSnippets
            onChange={(v) => onChange({ ...block, body: v })}
          />
        </div>
      );

    case "scope":
      return (
        <div className="space-y-3">
          <TextField label="Heading" value={block.heading} onChange={(v) => onChange({ ...block, heading: v })} />
          <RepeatingRowsField
            label="Rows"
            rows={block.rows}
            blank={{ capability: "", whatYouGet: "" }}
            addLabel="Add row"
            onChange={(rows) => onChange({ ...block, rows })}
            renderRow={(row, onUpdate) => (
              <div className="grid grid-cols-2 gap-2">
                <TextField label="Capability" value={row.capability} onChange={(v) => onUpdate({ ...row, capability: v })} />
                <TextField label="What you get" value={row.whatYouGet} onChange={(v) => onUpdate({ ...row, whatYouGet: v })} />
              </div>
            )}
          />
        </div>
      );

    case "not_included":
      return (
        <div className="space-y-3">
          <TextField label="Heading" value={block.heading} onChange={(v) => onChange({ ...block, heading: v })} />
          <StringListField label="Items" items={block.items} onChange={(items) => onChange({ ...block, items })} />
        </div>
      );

    case "recurring_plan":
      return (
        <div className="space-y-3">
          <TextField label="Heading" value={block.heading} onChange={(v) => onChange({ ...block, heading: v })} />
          <div className="grid grid-cols-2 gap-2">
            <TextField label="Plan name" value={block.planName} onChange={(v) => onChange({ ...block, planName: v })} />
            <NumberCentsField label="Monthly amount" cents={block.monthlyCents} onChange={(v) => onChange({ ...block, monthlyCents: v })} />
          </div>
          <TextField label="Cadence note" value={block.cadenceNote} onChange={(v) => onChange({ ...block, cadenceNote: v })} />
          <StringListField label="Features" items={block.features} onChange={(features) => onChange({ ...block, features })} />
        </div>
      );

    case "timeline":
      return (
        <div className="space-y-3">
          <TextField label="Heading" value={block.heading} onChange={(v) => onChange({ ...block, heading: v })} />
          <TextField label="Total duration" value={block.totalDuration} onChange={(v) => onChange({ ...block, totalDuration: v })} />
          <RepeatingRowsField
            label="Phases"
            rows={block.phases}
            blank={{ label: "", duration: "", detail: "" }}
            addLabel="Add phase"
            onChange={(phases) => onChange({ ...block, phases })}
            renderRow={(phase, onUpdate) => (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <TextField label="Label" value={phase.label} onChange={(v) => onUpdate({ ...phase, label: v })} />
                  <TextField label="Duration" value={phase.duration} onChange={(v) => onUpdate({ ...phase, duration: v })} />
                </div>
                <TextField label="Detail" value={phase.detail} onChange={(v) => onUpdate({ ...phase, detail: v })} />
              </div>
            )}
          />
        </div>
      );

    case "investment":
      return (
        <div className="space-y-3">
          <TextField label="Heading" value={block.heading} onChange={(v) => onChange({ ...block, heading: v })} />
          <TextAreaField
            label="Note"
            value={block.note}
            withSnippets
            onChange={(v) => onChange({ ...block, note: v })}
          />
          <p className="text-[11px] text-muted-foreground">
            This block renders the actual line items from the totals sidebar; this note is just supporting copy above the stack.
          </p>
        </div>
      );

    case "payment_terms":
      return (
        <div className="space-y-3">
          <TextField label="Heading" value={block.heading} onChange={(v) => onChange({ ...block, heading: v })} />
          <TextAreaField
            label="Body"
            value={block.body}
            withSnippets
            onChange={(v) => onChange({ ...block, body: v })}
          />
        </div>
      );

    case "two_paths":
      return (
        <div className="space-y-3">
          <TextField label="Heading" value={block.heading} withSnippets onChange={(v) => onChange({ ...block, heading: v })} />
          <div className="grid grid-cols-2 gap-2">
            <TextField label="Managed label" value={block.managedLabel} onChange={(v) => onChange({ ...block, managedLabel: v })} />
            <TextField label="Own-it label" value={block.ownItLabel} onChange={(v) => onChange({ ...block, ownItLabel: v })} />
          </div>
          <TextAreaField
            label="Managed body"
            value={block.managedBody}
            withSnippets
            onChange={(v) => onChange({ ...block, managedBody: v })}
          />
          <TextAreaField
            label="Own-it body"
            value={block.ownItBody}
            withSnippets
            onChange={(v) => onChange({ ...block, ownItBody: v })}
          />
          <div className="grid grid-cols-3 gap-2">
            <TextField
              label="Months"
              value={String(block.months)}
              onChange={(v) => onChange({ ...block, months: Number(v) || 0 })}
            />
            <NumberCentsField
              label="Managed / month"
              cents={block.managedMonthlyCents}
              onChange={(v) => onChange({ ...block, managedMonthlyCents: v })}
            />
            <NumberCentsField
              label="Own it (one-time)"
              cents={block.ownItOneTimeCents}
              onChange={(v) => onChange({ ...block, ownItOneTimeCents: v })}
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            These figures are display-only for the comparison table. They are not pulled from the line items automatically; keep them
            in sync with the recurring/handoff rows below if you change pricing.
          </p>
        </div>
      );

    case "tech_stack":
      return (
        <div className="space-y-3">
          <TextField label="Heading" value={block.heading} onChange={(v) => onChange({ ...block, heading: v })} />
          <RepeatingRowsField
            label="Rows"
            rows={block.rows}
            blank={{ tool: "", purpose: "", costNote: "" }}
            addLabel="Add row"
            onChange={(rows) => onChange({ ...block, rows })}
            renderRow={(row, onUpdate) => (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <TextField label="Tool" value={row.tool} onChange={(v) => onUpdate({ ...row, tool: v })} />
                  <TextField label="Purpose" value={row.purpose} onChange={(v) => onUpdate({ ...row, purpose: v })} />
                </div>
                <TextField label="Cost note" value={row.costNote} onChange={(v) => onUpdate({ ...row, costNote: v })} />
              </div>
            )}
          />
        </div>
      );

    case "third_party_costs":
      return (
        <div className="space-y-3">
          <TextField label="Heading" value={block.heading} onChange={(v) => onChange({ ...block, heading: v })} />
          <RepeatingRowsField
            label="Rows"
            rows={block.rows}
            blank={{ item: "", cadence: "", amountCents: 0 }}
            addLabel="Add row"
            onChange={(rows) => onChange({ ...block, rows })}
            renderRow={(row, onUpdate) => (
              <div className="grid grid-cols-3 gap-2">
                <TextField label="Item" value={row.item} onChange={(v) => onUpdate({ ...row, item: v })} />
                <TextField label="Cadence" value={row.cadence} onChange={(v) => onUpdate({ ...row, cadence: v })} />
                <NumberCentsField label="Amount" cents={row.amountCents} onChange={(v) => onUpdate({ ...row, amountCents: v })} />
              </div>
            )}
          />
        </div>
      );

    case "roadmap":
      return (
        <div className="space-y-3">
          <TextField label="Heading" value={block.heading} onChange={(v) => onChange({ ...block, heading: v })} />
          <RepeatingRowsField
            label="Phases"
            rows={block.phases}
            blank={{ label: "", body: "" }}
            addLabel="Add phase"
            onChange={(phases) => onChange({ ...block, phases })}
            renderRow={(phase, onUpdate) => (
              <div className="space-y-2">
                <TextField label="Label" value={phase.label} onChange={(v) => onUpdate({ ...phase, label: v })} />
                <TextAreaField label="Body" value={phase.body} withSnippets onChange={(v) => onUpdate({ ...phase, body: v })} />
              </div>
            )}
          />
        </div>
      );

    case "liability":
      return (
        <div className="space-y-3">
          <TextField label="Heading" value={block.heading} onChange={(v) => onChange({ ...block, heading: v })} />
          <StringListField
            label="Responsible"
            items={block.responsible}
            onChange={(responsible) => onChange({ ...block, responsible })}
          />
          <StringListField
            label="Not responsible"
            items={block.notResponsible}
            onChange={(notResponsible) => onChange({ ...block, notResponsible })}
          />
          <TextField
            label="Liability cap"
            value={block.liabilityCap}
            withSnippets
            onChange={(v) => onChange({ ...block, liabilityCap: v })}
          />
          <StringListField
            label="Client obligations"
            items={block.clientObligations}
            onChange={(clientObligations) => onChange({ ...block, clientObligations })}
          />
        </div>
      );

    case "next_steps":
      return (
        <div className="space-y-3">
          <TextField label="Heading" value={block.heading} onChange={(v) => onChange({ ...block, heading: v })} />
          <StringListField label="Steps" items={block.steps} onChange={(steps) => onChange({ ...block, steps })} />
          <TextField
            label="Approval window"
            value={block.approvalWindow}
            withSnippets
            onChange={(v) => onChange({ ...block, approvalWindow: v })}
          />
        </div>
      );

    case "acceptance":
      return (
        <div className="space-y-3">
          <TextField label="Heading" value={block.heading} onChange={(v) => onChange({ ...block, heading: v })} />
          <TextAreaField label="Body" value={block.body} onChange={(v) => onChange({ ...block, body: v })} />
          <div className="flex items-center gap-2">
            <Checkbox checked={block.dual} onCheckedChange={(checked) => onChange({ ...block, dual: checked === true })} />
            <Label className="font-normal">Requires dual signature</Label>
          </div>
        </div>
      );

    case "callout":
      return (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Tone</Label>
            <div className="flex gap-2">
              {(["info", "warn", "trust"] as const).map((tone) => (
                <button
                  key={tone}
                  type="button"
                  onClick={() => onChange({ ...block, tone })}
                  className={`rounded-md border px-2.5 py-1 text-xs capitalize transition-colors ${
                    block.tone === tone ? "border-foreground text-foreground" : "border-border text-muted-foreground"
                  }`}
                >
                  {tone}
                </button>
              ))}
            </div>
          </div>
          <TextAreaField label="Body" value={block.body} withSnippets onChange={(v) => onChange({ ...block, body: v })} />
        </div>
      );

    default: {
      const _exhaustive: never = block;
      return _exhaustive;
    }
  }
}
