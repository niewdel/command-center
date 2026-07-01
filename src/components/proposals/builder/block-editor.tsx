"use client";

// Block editor (Task P4): add / remove / reorder proposal content blocks
// (up/down buttons, no drag-drop dependency) and edit each block's fields
// via the typed BlockForm switch.

import { useState } from "react";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ProposalBlock, ProposalContent } from "@/types/proposals";
import { BLOCK_TYPES, BLOCK_TYPE_LABEL, defaultBlockFor } from "@/lib/proposals/block-defaults";
import { BlockForm } from "./block-forms";

function blockLabel(block: ProposalBlock): string {
  if ("heading" in block) return block.heading || BLOCK_TYPE_LABEL[block.type];
  if (block.type === "cover") return block.headline || "Cover";
  return BLOCK_TYPE_LABEL[block.type];
}

export function BlockEditor({
  content,
  onChange,
  readOnly,
}: {
  content: ProposalContent;
  onChange: (next: ProposalContent) => void;
  readOnly?: boolean;
}) {
  const [expanded, setExpanded] = useState<number | null>(0);

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= content.length) return;
    const next = [...content];
    const tmp = next[index]!;
    next[index] = next[target]!;
    next[target] = tmp;
    onChange(next);
    setExpanded(target);
  };

  const remove = (index: number) => {
    onChange(content.filter((_, i) => i !== index));
    setExpanded(null);
  };

  const update = (index: number, block: ProposalBlock) => {
    const next = [...content];
    next[index] = block;
    onChange(next);
  };

  const add = (type: ProposalBlock["type"]) => {
    onChange([...content, defaultBlockFor(type)]);
    setExpanded(content.length);
  };

  return (
    <div className="space-y-2">
      {content.map((block, i) => {
        const isOpen = expanded === i;
        return (
          <div key={i} className="rounded-lg border border-border">
            <div className="flex items-center gap-2 p-2.5">
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : i)}
                className="flex-1 min-w-0 text-left"
              >
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {BLOCK_TYPE_LABEL[block.type]}
                </span>
                <p className="text-sm font-medium truncate">{blockLabel(block)}</p>
              </button>
              {!readOnly && (
                <div className="flex items-center gap-0.5 shrink-0">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Move block up"
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                  >
                    <ChevronUp />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Move block down"
                    disabled={i === content.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    <ChevronDown />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Remove block"
                    onClick={() => remove(i)}
                  >
                    <Trash2 className="text-muted-foreground" />
                  </Button>
                </div>
              )}
            </div>
            {isOpen && (
              <div className="border-t border-border p-3">
                {readOnly ? (
                  <p className="text-xs text-muted-foreground">Read-only, this proposal can no longer be edited.</p>
                ) : (
                  <BlockForm block={block} onChange={(next) => update(i, next)} />
                )}
              </div>
            )}
          </div>
        );
      })}

      {!readOnly && (
        <DropdownMenu>
          <DropdownMenuTrigger
            className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
          >
            <Plus className="size-3.5" /> Add block
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto">
            {BLOCK_TYPES.map((type) => (
              <DropdownMenuItem key={type} onClick={() => add(type)}>
                {BLOCK_TYPE_LABEL[type]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
