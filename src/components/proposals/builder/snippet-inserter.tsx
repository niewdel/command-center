"use client";

// Snippet inserter (Task P4): a small dropdown that inserts a tokenized
// Niewdel voice snippet (src/lib/proposals/snippets.ts) into whatever text
// field it's attached to. Callers pass the current field value + a setter;
// this component never owns the field's state.

import { Sparkles } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { insertSnippetInto, snippetsByCategory } from "@/lib/proposals/snippets";

export function SnippetInserter({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const groups = snippetsByCategory();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex items-center justify-center size-6 shrink-0 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        aria-label="Insert voice snippet"
        title="Insert a Niewdel voice snippet"
      >
        <Sparkles className="size-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto w-72">
        {groups.map((group, i) => (
          <div key={group.category}>
            {i > 0 && <DropdownMenuSeparator />}
            <DropdownMenuLabel>{group.label}</DropdownMenuLabel>
            {group.snippets.map((s) => (
              <DropdownMenuItem
                key={s.id}
                onClick={() => onChange(insertSnippetInto(value, s.text))}
                className="text-xs whitespace-normal"
              >
                {s.text}
              </DropdownMenuItem>
            ))}
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
