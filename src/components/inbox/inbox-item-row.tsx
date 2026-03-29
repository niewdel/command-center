"use client";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Star, Paperclip } from "lucide-react";
import type { InboxItem } from "@/types/database";

type InboxItemRowProps = {
  item: InboxItem;
  isSelected: boolean;
  onSelect: () => void;
  onToggleStar: () => void;
  onMarkRead: () => void;
};

const avatarColors = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-purple-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-orange-500",
  "bg-teal-500",
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

function getRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const categoryConfig: Record<
  string,
  { label: string; variant: "destructive" | "default" | "secondary" | "outline" }
> = {
  action_required: { label: "Action Required", variant: "destructive" },
  needs_response: { label: "Needs Response", variant: "default" },
  informational: { label: "Informational", variant: "secondary" },
  promotional: { label: "Promotional", variant: "outline" },
};

export function InboxItemRow({
  item,
  isSelected,
  onSelect,
  onToggleStar,
  onMarkRead,
}: InboxItemRowProps) {
  const senderInitial = (item.sender_name || item.sender_email || "?")[0].toUpperCase();
  const senderName = item.sender_name || item.sender_email || "Unknown";
  const avatarColor = getAvatarColor(senderName);
  const category = item.ai_category ? categoryConfig[item.ai_category] : null;

  const handleClick = () => {
    if (!item.is_read) {
      onMarkRead();
    }
    onSelect();
  };

  const handleStarClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleStar();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "group flex w-full items-start gap-3 rounded-lg px-3 py-3 text-left transition-colors",
        "hover:bg-muted/50",
        isSelected && "bg-muted",
        !item.is_read && "bg-primary/[0.03]"
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg text-sm font-medium text-white",
          avatarColor
        )}
      >
        {senderInitial}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "truncate text-sm",
              !item.is_read ? "font-semibold text-foreground" : "font-medium text-foreground"
            )}
          >
            {senderName}
          </span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {getRelativeTime(item.received_at)}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              "truncate text-sm",
              !item.is_read ? "font-medium text-foreground" : "text-muted-foreground"
            )}
          >
            {item.subject || "(no subject)"}
          </span>
          {item.has_attachments && (
            <Paperclip className="size-3 shrink-0 text-muted-foreground" />
          )}
        </div>

        {item.ai_summary ? (
          <p className="truncate text-xs text-muted-foreground/80 mt-0.5">
            {item.ai_summary}
          </p>
        ) : item.snippet ? (
          <p className="truncate text-xs text-muted-foreground/80 mt-0.5">
            {item.snippet}
          </p>
        ) : null}

        {category && (
          <div className="mt-1.5">
            <Badge variant={category.variant}>{category.label}</Badge>
          </div>
        )}
      </div>

      {/* Star */}
      <Button
        variant="ghost"
        size="icon-xs"
        className={cn(
          "shrink-0 mt-0.5",
          item.is_starred
            ? "text-amber-500"
            : "text-muted-foreground/40 opacity-0 group-hover:opacity-100"
        )}
        onClick={handleStarClick}
      >
        <Star className={cn("size-3.5", item.is_starred && "fill-current")} />
      </Button>

      {/* Unread indicator */}
      {!item.is_read && (
        <div className="mt-2.5 size-2 shrink-0 rounded-full bg-primary" />
      )}
    </button>
  );
}
