"use client";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ListTodo, Paperclip } from "lucide-react";
import type { InboxItem } from "@/types/database";

type InboxDetailSheetProps = {
  item: InboxItem | null;
  open: boolean;
  onClose: () => void;
  onCreateTask: () => void;
};

const categoryConfig: Record<
  string,
  { label: string; variant: "destructive" | "default" | "secondary" | "outline" }
> = {
  action_required: { label: "Action Required", variant: "destructive" },
  needs_response: { label: "Needs Response", variant: "default" },
  informational: { label: "Informational", variant: "secondary" },
  promotional: { label: "Promotional", variant: "outline" },
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function InboxDetailSheet({
  item,
  open,
  onClose,
  onCreateTask,
}: InboxDetailSheetProps) {
  if (!item) return null;

  const category = item.ai_category ? categoryConfig[item.ai_category] : null;
  const recipients = item.recipients || [];
  const toRecipients = recipients.filter((r) => r.type === "to");
  const ccRecipients = recipients.filter((r) => r.type === "cc");

  return (
    <Sheet open={open} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader className="border-b pb-4">
          <div className="flex items-start justify-between gap-2 pr-8">
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-base leading-snug">
                {item.subject || "(no subject)"}
              </SheetTitle>
              <SheetDescription className="mt-1">
                {item.sender_name || item.sender_email || "Unknown sender"}
              </SheetDescription>
            </div>
            <Button variant="outline" size="sm" onClick={onCreateTask}>
              <ListTodo className="size-3.5" data-icon="inline-start" />
              Create Task
            </Button>
          </div>

          {/* Category + AI summary */}
          {(category || item.ai_summary) && (
            <div className="mt-3 space-y-2">
              {category && (
                <Badge variant={category.variant}>{category.label}</Badge>
              )}
              {item.ai_summary && (
                <p className="text-sm text-muted-foreground rounded-lg bg-muted/50 p-2.5">
                  {item.ai_summary}
                </p>
              )}
            </div>
          )}
        </SheetHeader>

        {/* Email metadata */}
        <div className="space-y-3 p-4 text-sm">
          <div className="space-y-1.5">
            <div className="flex gap-2">
              <span className="shrink-0 text-muted-foreground w-12">From</span>
              <span className="text-foreground">
                {item.sender_name && (
                  <span className="font-medium">{item.sender_name} </span>
                )}
                {item.sender_email && (
                  <span className="text-muted-foreground">&lt;{item.sender_email}&gt;</span>
                )}
              </span>
            </div>

            {toRecipients.length > 0 && (
              <div className="flex gap-2">
                <span className="shrink-0 text-muted-foreground w-12">To</span>
                <span className="text-foreground">
                  {toRecipients
                    .map((r) => r.name || r.email)
                    .join(", ")}
                </span>
              </div>
            )}

            {ccRecipients.length > 0 && (
              <div className="flex gap-2">
                <span className="shrink-0 text-muted-foreground w-12">CC</span>
                <span className="text-foreground">
                  {ccRecipients
                    .map((r) => r.name || r.email)
                    .join(", ")}
                </span>
              </div>
            )}

            <div className="flex gap-2">
              <span className="shrink-0 text-muted-foreground w-12">Date</span>
              <span className="text-foreground">{formatDate(item.received_at)}</span>
            </div>
          </div>

          {item.has_attachments && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Paperclip className="size-3.5" />
              <span className="text-xs">Has attachments</span>
            </div>
          )}

          {/* Email body / snippet */}
          {item.snippet && (
            <div className="border-t pt-4">
              <p className="whitespace-pre-wrap text-sm text-foreground leading-relaxed">
                {item.snippet}
              </p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
