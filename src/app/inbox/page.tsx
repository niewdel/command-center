"use client";

import { useState, useMemo } from "react";
import { Mail } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { PageLayout } from "@/components/layout/page-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useInbox } from "@/lib/hooks/use-inbox";
import { InboxList } from "@/components/inbox/inbox-list";
import { InboxDetailSheet } from "@/components/inbox/inbox-detail-sheet";
import { CreateTaskFromEmail } from "@/components/inbox/create-task-from-email";
import type { InboxItem } from "@/types/database";

type FilterKey =
  | "all"
  | "action_required"
  | "needs_response"
  | "informational"
  | "unread"
  | "starred";

const filters: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "action_required", label: "Action Required" },
  { key: "needs_response", label: "Needs Response" },
  { key: "informational", label: "Informational" },
  { key: "unread", label: "Unread" },
  { key: "starred", label: "Starred" },
];

export default function InboxPage() {
  const { items, loading, connections, unreadCount, markAsRead, toggleStar, refetch } =
    useInbox();
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const [selectedItem, setSelectedItem] = useState<InboxItem | null>(null);
  const [taskDialogItem, setTaskDialogItem] = useState<InboxItem | null>(null);

  const filteredItems = useMemo(() => {
    switch (activeFilter) {
      case "action_required":
        return items.filter((i) => i.ai_category === "action_required");
      case "needs_response":
        return items.filter((i) => i.ai_category === "needs_response");
      case "informational":
        return items.filter((i) => i.ai_category === "informational");
      case "unread":
        return items.filter((i) => !i.is_read);
      case "starred":
        return items.filter((i) => i.is_starred);
      default:
        return items;
    }
  }, [items, activeFilter]);

  const filterCounts = useMemo(() => {
    const counts: Record<FilterKey, number> = {
      all: items.length,
      action_required: items.filter((i) => i.ai_category === "action_required").length,
      needs_response: items.filter((i) => i.ai_category === "needs_response").length,
      informational: items.filter((i) => i.ai_category === "informational").length,
      unread: items.filter((i) => !i.is_read).length,
      starred: items.filter((i) => i.is_starred).length,
    };
    return counts;
  }, [items]);

  const handleSelect = (item: InboxItem) => {
    setSelectedItem(item);
  };

  const handleCreateTask = () => {
    if (selectedItem) {
      setTaskDialogItem(selectedItem);
    }
  };

  const handleTaskCreated = () => {
    setTaskDialogItem(null);
    refetch();
  };

  const hasConnections = connections.length > 0;

  return (
    <PageLayout
      title="Inbox"
      icon={Mail}
      description={
        unreadCount > 0 ? `${unreadCount} unread` : "All caught up"
      }
      loading={loading}
      maxWidth="lg"
    >
      {!hasConnections && items.length === 0 ? (
        /* Empty state — no connections */
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex size-14 items-center justify-center rounded-lg bg-muted">
            <Mail className="size-7 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-base font-medium font-heading">
            No email accounts connected
          </h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Connect your email accounts in Settings to get started with your
            unified inbox.
          </p>
          <Button variant="outline" className="mt-4" render={<Link href="/settings" />}>
            Go to Settings
          </Button>
        </div>
      ) : (
        <>
          {/* Filter tabs */}
          <div className="flex flex-wrap gap-1.5">
            {filters.map((filter) => {
              const count = filterCounts[filter.key];
              const isActive = activeFilter === filter.key;
              return (
                <Button
                  key={filter.key}
                  variant={isActive ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setActiveFilter(filter.key)}
                  className="gap-1.5"
                >
                  {filter.label}
                  {count > 0 && (
                    <Badge
                      variant={isActive ? "default" : "secondary"}
                      className="ml-0.5 min-w-5 justify-center px-1.5"
                    >
                      {count}
                    </Badge>
                  )}
                </Button>
              );
            })}
          </div>

          {/* Inbox list */}
          <InboxList
            items={filteredItems}
            onSelect={handleSelect}
            selectedId={selectedItem?.id || null}
            onToggleStar={toggleStar}
            onMarkRead={markAsRead}
          />

          {/* Detail sheet */}
          <InboxDetailSheet
            item={selectedItem}
            open={!!selectedItem}
            onClose={() => setSelectedItem(null)}
            onCreateTask={handleCreateTask}
          />

          {/* Create task dialog */}
          <CreateTaskFromEmail
            item={taskDialogItem}
            open={!!taskDialogItem}
            onClose={() => setTaskDialogItem(null)}
            onCreated={handleTaskCreated}
          />
        </>
      )}
    </PageLayout>
  );
}
