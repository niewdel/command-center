"use client";

// Small typed form-field primitives shared by every block editor
// (src/components/proposals/builder/block-forms.tsx). Kept dumb and
// generic on purpose: each block form composes these rather than each
// re-implementing label/input wiring.

import type { ReactNode } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { SnippetInserter } from "./snippet-inserter";
import { centsToDollarsInput, parseDollarsToCents } from "@/lib/proposals/money";

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  withSnippets,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  withSnippets?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        {withSnippets && <SnippetInserter value={value} onChange={onChange} />}
      </div>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

export function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
  withSnippets,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  rows?: number;
  withSnippets?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        {withSnippets && <SnippetInserter value={value} onChange={onChange} />}
      </div>
      <Textarea rows={rows} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

/** A plain string list (e.g. "not included" items, next steps). */
export function StringListField({
  label,
  items,
  onChange,
  placeholder,
}: {
  label: string;
  items: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="space-y-1.5">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <Input
              value={item}
              placeholder={placeholder}
              onChange={(e) => {
                const next = [...items];
                next[i] = e.target.value;
                onChange(next);
              }}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="Remove item"
              onClick={() => onChange(items.filter((_, idx) => idx !== i))}
            >
              <Trash2 className="text-muted-foreground" />
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={() => onChange([...items, ""])} className="gap-1">
          <Plus /> Add
        </Button>
      </div>
    </div>
  );
}

/** A repeating list of typed row objects (scope rows, timeline phases, etc.). */
export function RepeatingRowsField<T>({
  label,
  rows,
  onChange,
  blank,
  renderRow,
  addLabel = "Add row",
}: {
  label: string;
  rows: T[];
  onChange: (next: T[]) => void;
  blank: T;
  renderRow: (row: T, onUpdate: (next: T) => void) => ReactNode;
  addLabel?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="space-y-2">
        {rows.map((row, i) => (
          <div key={i} className="flex items-start gap-1.5 rounded-md border border-border p-2">
            <div className="flex-1 min-w-0">
              {renderRow(row, (next) => {
                const updated = [...rows];
                updated[i] = next;
                onChange(updated);
              })}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="Remove row"
              onClick={() => onChange(rows.filter((_, idx) => idx !== i))}
            >
              <Trash2 className="text-muted-foreground" />
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={() => onChange([...rows, blank])} className="gap-1">
          <Plus /> {addLabel}
        </Button>
      </div>
    </div>
  );
}

export function NumberCentsField({
  label,
  cents,
  onChange,
}: {
  label: string;
  cents: number;
  onChange: (nextCents: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex items-center gap-1.5">
        <span className="text-sm text-muted-foreground">$</span>
        <Input
          inputMode="decimal"
          defaultValue={centsToDollarsInput(cents)}
          key={cents}
          onBlur={(e) => onChange(parseDollarsToCents(e.target.value))}
        />
      </div>
    </div>
  );
}
