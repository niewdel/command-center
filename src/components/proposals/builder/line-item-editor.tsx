"use client";

// Line-item editor (Task P4): add / remove / reorder rows and edit every
// field the P1 pricing engine + P2 API care about. Persists via
// PUT /api/pipeline/proposals/[id]/line-items (handled by the parent page).

import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LINE_ITEM_CADENCES,
  LINE_ITEM_CADENCE_LABEL,
  LINE_ITEM_KINDS,
  LINE_ITEM_KIND_LABEL,
  type CrmProposalLineItem,
  type LineItemCadence,
  type LineItemKind,
} from "@/types/proposals";
import { centsToDollarsInput, parseDollarsToCents } from "@/lib/proposals/money";

export type EditableLineItem = Omit<CrmProposalLineItem, "id" | "workspace_id" | "proposal_id" | "created_at"> & {
  /** Stable client-side key (line items may not have a real id yet). */
  _key: string;
};

export function blankLineItem(position: number): EditableLineItem {
  return {
    _key: `new-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    kind: "one_time",
    label: "",
    description: null,
    badge: null,
    amount_cents: 0,
    cadence: "one_time",
    recurring_months: null,
    option_group: null,
    is_optional: false,
    is_selected: true,
    position,
  };
}

export function LineItemEditor({
  items,
  onChange,
  readOnly,
}: {
  items: EditableLineItem[];
  onChange: (next: EditableLineItem[]) => void;
  readOnly?: boolean;
}) {
  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    const tmp = next[index]!;
    next[index] = next[target]!;
    next[target] = tmp;
    onChange(next.map((item, i) => ({ ...item, position: i })));
  };

  const remove = (index: number) => {
    onChange(
      items.filter((_, i) => i !== index).map((item, i) => ({ ...item, position: i }))
    );
  };

  const update = (index: number, patch: Partial<EditableLineItem>) => {
    const next = [...items];
    next[index] = { ...next[index]!, ...patch };
    onChange(next);
  };

  const add = () => {
    onChange([...items, blankLineItem(items.length)]);
  };

  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={item._key} className="rounded-lg border border-border p-3 space-y-2">
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0 grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label>Label</Label>
                <Input
                  disabled={readOnly}
                  value={item.label}
                  onChange={(e) => update(i, { label: e.target.value })}
                  placeholder="Website Build"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Badge</Label>
                <Input
                  disabled={readOnly}
                  value={item.badge ?? ""}
                  onChange={(e) => update(i, { badge: e.target.value || null })}
                  placeholder="Recommended"
                />
              </div>
            </div>
            {!readOnly && (
              <div className="flex items-center gap-0.5 shrink-0 pt-6">
                <Button type="button" variant="ghost" size="icon-xs" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
                  <ChevronUp />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Move down"
                  disabled={i === items.length - 1}
                  onClick={() => move(i, 1)}
                >
                  <ChevronDown />
                </Button>
                <Button type="button" variant="ghost" size="icon-xs" aria-label="Remove line item" onClick={() => remove(i)}>
                  <Trash2 className="text-muted-foreground" />
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Description</Label>
            <Input
              disabled={readOnly}
              value={item.description ?? ""}
              onChange={(e) => update(i, { description: e.target.value || null })}
            />
          </div>

          <div className="grid grid-cols-4 gap-2">
            <div className="space-y-1.5">
              <Label>Kind</Label>
              <Select
                disabled={readOnly}
                value={item.kind}
                onValueChange={(v) => v && update(i, { kind: v as LineItemKind })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LINE_ITEM_KINDS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {LINE_ITEM_KIND_LABEL[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Cadence</Label>
              <Select
                disabled={readOnly}
                value={item.cadence}
                onValueChange={(v) => v && update(i, { cadence: v as LineItemCadence })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LINE_ITEM_CADENCES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {LINE_ITEM_CADENCE_LABEL[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Amount</Label>
              <div className="flex items-center gap-1">
                <span className="text-sm text-muted-foreground">$</span>
                <Input
                  disabled={readOnly}
                  inputMode="decimal"
                  key={item.amount_cents}
                  defaultValue={centsToDollarsInput(item.amount_cents)}
                  onBlur={(e) => update(i, { amount_cents: parseDollarsToCents(e.target.value) })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Recurring months</Label>
              <Input
                disabled={readOnly}
                type="number"
                min={0}
                value={item.recurring_months ?? ""}
                placeholder="Evergreen"
                onChange={(e) => update(i, { recurring_months: e.target.value ? Number(e.target.value) : null })}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 items-end">
            <div className="space-y-1.5">
              <Label>Option group</Label>
              <Input
                disabled={readOnly}
                value={item.option_group ?? ""}
                placeholder="e.g. ownership_path"
                onChange={(e) => update(i, { option_group: e.target.value || null })}
              />
            </div>
            <label className="flex items-center gap-2 pb-2">
              <Checkbox
                disabled={readOnly}
                checked={item.is_optional}
                onCheckedChange={(checked) => update(i, { is_optional: checked === true })}
              />
              <span className="text-sm">Optional</span>
            </label>
            <label className="flex items-center gap-2 pb-2">
              <Checkbox
                disabled={readOnly}
                checked={item.is_selected}
                onCheckedChange={(checked) => update(i, { is_selected: checked === true })}
              />
              <span className="text-sm">Selected</span>
            </label>
          </div>
        </div>
      ))}

      {!readOnly && (
        <Button type="button" variant="outline" size="sm" onClick={add} className="gap-1.5">
          <Plus className="size-3.5" /> Add line item
        </Button>
      )}
    </div>
  );
}
