"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { InboxItemRow } from "@/components/inbox/inbox-item-row";
import type { InboxItem } from "@/types/database";

type InboxListProps = {
  items: InboxItem[];
  onSelect: (item: InboxItem) => void;
  selectedId: string | null;
  onToggleStar: (id: string) => void;
  onMarkRead: (id: string) => void;
};

type DateGroup = {
  label: string;
  items: InboxItem[];
};

function groupByDate(items: InboxItem[]): DateGroup[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekStart = new Date(today);
  weekStart.setDate(weekStart.getDate() - today.getDay());

  const groups: Record<string, InboxItem[]> = {
    Today: [],
    Yesterday: [],
    "This Week": [],
    Earlier: [],
  };

  for (const item of items) {
    const date = new Date(item.received_at);
    const itemDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    if (itemDate.getTime() === today.getTime()) {
      groups["Today"].push(item);
    } else if (itemDate.getTime() === yesterday.getTime()) {
      groups["Yesterday"].push(item);
    } else if (itemDate >= weekStart) {
      groups["This Week"].push(item);
    } else {
      groups["Earlier"].push(item);
    }
  }

  return Object.entries(groups)
    .filter(([, items]) => items.length > 0)
    .map(([label, items]) => ({ label, items }));
}

export function InboxList({
  items,
  onSelect,
  selectedId,
  onToggleStar,
  onMarkRead,
}: InboxListProps) {
  const groups = useMemo(() => groupByDate(items), [items]);

  if (items.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        No emails match the current filter.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div key={group.label}>
          <h3 className={cn("px-3 pb-1 text-xs font-medium text-muted-foreground font-heading")}>
            {group.label}
          </h3>
          <div className="space-y-0.5">
            {group.items.map((item) => (
              <InboxItemRow
                key={item.id}
                item={item}
                isSelected={selectedId === item.id}
                onSelect={() => onSelect(item)}
                onToggleStar={() => onToggleStar(item.id)}
                onMarkRead={() => onMarkRead(item.id)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
