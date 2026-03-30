"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Issue, Workspace, Project, Client, Goal } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { PageLayout } from "@/components/layout/page-layout";
import {
  Bug,
  Plus,
  Pencil,
  Trash2,
  Lightbulb,
  CheckCircle2,
  Circle,
  Clock,
  XCircle,
  Bot,
  User,
  Link as LinkIcon,
} from "lucide-react";

type LinkableEntity = {
  type: Issue["linked_entity_type"];
  id: string;
  label: string;
};

const STATUS_CONFIG = {
  open: { label: "Open", icon: Circle, color: "text-blue-400" },
  in_progress: { label: "In Progress", icon: Clock, color: "text-amber-400" },
  resolved: { label: "Resolved", icon: CheckCircle2, color: "text-emerald-400" },
  closed: { label: "Closed", icon: XCircle, color: "text-muted-foreground" },
} as const;

const PRIORITY_CONFIG = {
  low: { label: "Low", color: "bg-muted text-muted-foreground" },
  medium: { label: "Medium", color: "bg-blue-500/15 text-blue-400" },
  high: { label: "High", color: "bg-amber-500/15 text-amber-400" },
  critical: { label: "Critical", color: "bg-red-500/15 text-red-400" },
} as const;

const FILTER_TABS = [
  { key: "all", label: "All" },
  { key: "open", label: "Open" },
  { key: "in_progress", label: "In Progress" },
  { key: "resolved", label: "Resolved" },
  { key: "closed", label: "Closed" },
] as const;

export default function IssuesPage() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [linkableEntities, setLinkableEntities] = useState<LinkableEntity[]>([]);
  const [editingIssue, setEditingIssue] = useState<Issue | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "bug" | "feature">("all");

  const fetchData = useCallback(async () => {
    const [{ data: issuesData }, { data: workspaces }, { data: projects }, { data: clients }, { data: goals }] =
      await Promise.all([
        supabase.from("issues").select("*").order("created_at", { ascending: false }),
        supabase.from("workspaces").select("id, name"),
        supabase.from("projects").select("id, name"),
        supabase.from("clients").select("id, name"),
        supabase.from("goals").select("id, title"),
      ]);

    setIssues(issuesData || []);

    const entities: LinkableEntity[] = [
      // Pages
      { type: "page", id: "dashboard", label: "Dashboard" },
      { type: "page", id: "inbox", label: "Inbox" },
      { type: "page", id: "calendar", label: "Calendar" },
      { type: "page", id: "goals", label: "Goals" },
      { type: "page", id: "notes", label: "Notes" },
      { type: "page", id: "digests", label: "Digests" },
      { type: "page", id: "settings", label: "Settings" },
      { type: "page", id: "issues", label: "Issues" },
      // Dynamic entities
      ...(workspaces || []).map((w) => ({ type: "workspace" as const, id: w.id, label: w.name })),
      ...(projects || []).map((p) => ({ type: "project" as const, id: p.id, label: p.name })),
      ...(clients || []).map((c) => ({ type: "client" as const, id: c.id, label: c.name })),
      ...(goals || []).map((g) => ({ type: "goal" as const, id: g.id, label: g.title })),
    ];

    setLinkableEntities(entities);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel("issues-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "issues" }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  const handleDelete = async (id: string) => {
    await supabase.from("issues").delete().eq("id", id);
    fetchData();
  };

  const handleStatusChange = async (id: string, status: Issue["status"]) => {
    const updates: Record<string, unknown> = { status };
    if (status === "resolved") {
      updates.resolved_by = "user";
      updates.resolved_at = new Date().toISOString();
    } else if (status === "open" || status === "in_progress") {
      updates.resolved_by = null;
      updates.resolved_at = null;
    }
    await supabase.from("issues").update(updates).eq("id", id);
    fetchData();
  };

  const filtered = issues.filter((issue) => {
    if (filter !== "all" && issue.status !== filter) return false;
    if (typeFilter !== "all" && issue.type !== typeFilter) return false;
    return true;
  });

  const openCount = issues.filter((i) => i.status === "open").length;
  const inProgressCount = issues.filter((i) => i.status === "in_progress").length;

  return (
    <PageLayout
      title="Issues"
      description={`${openCount} open${inProgressCount > 0 ? `, ${inProgressCount} in progress` : ""}`}
      icon={Bug}
      loading={loading}
      actions={
        <Button
          onClick={() => {
            setEditingIssue(null);
            setShowAdd(true);
          }}
          className="gap-2 bg-foreground hover:bg-foreground/90 text-background border-0 rounded-lg shadow-md"
          size="sm"
        >
          <Plus className="size-4" />
          New Issue
        </Button>
      }
    >
      {/* Filter tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1 bg-muted/30 rounded-lg p-1">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                filter === tab.key
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 bg-muted/30 rounded-lg p-1">
          {(["all", "bug", "feature"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5",
                typeFilter === t
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t === "bug" && <Bug className="size-3" />}
              {t === "feature" && <Lightbulb className="size-3" />}
              {t === "all" ? "All Types" : t === "bug" ? "Bugs" : "Features"}
            </button>
          ))}
        </div>
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="text-center py-16">
          <div className="inline-flex size-14 items-center justify-center rounded-2xl bg-muted/50 mb-4">
            <Bug className="size-7 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-pretty">
            {issues.length === 0 ? "No issues yet" : "No issues match this filter"}
          </p>
          <p className="text-xs text-muted-foreground mt-1 text-pretty">
            {issues.length === 0
              ? "Report a bug or request a feature to get started."
              : "Try adjusting the filters above."}
          </p>
        </div>
      )}

      {/* Issue list */}
      {filtered.length > 0 && (
        <div className="space-y-2">
          {filtered.map((issue) => {
            const statusCfg = STATUS_CONFIG[issue.status];
            const priorityCfg = PRIORITY_CONFIG[issue.priority];
            const StatusIcon = statusCfg.icon;
            return (
              <div
                key={issue.id}
                className="group rounded-lg border border-border/50 bg-card/50 p-4 hover:bg-card hover:border-border transition-colors"
              >
                <div className="flex items-start gap-3">
                  {/* Status icon */}
                  <button
                    onClick={() => {
                      const order: Issue["status"][] = ["open", "in_progress", "resolved", "closed"];
                      const next = order[(order.indexOf(issue.status) + 1) % order.length];
                      handleStatusChange(issue.id, next);
                    }}
                    className={cn("mt-0.5 shrink-0 transition-colors", statusCfg.color)}
                    aria-label={`Status: ${statusCfg.label}. Click to cycle.`}
                  >
                    <StatusIcon className="size-5" />
                  </button>

                  {/* Content */}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold truncate">{issue.title}</h3>
                      {issue.type === "bug" ? (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-red-500/30 text-red-400 shrink-0">
                          Bug
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-purple-500/30 text-purple-400 shrink-0">
                          Feature
                        </Badge>
                      )}
                      <Badge className={cn("text-[10px] px-1.5 py-0 border-0 shrink-0", priorityCfg.color)}>
                        {priorityCfg.label}
                      </Badge>
                    </div>

                    {issue.description && (
                      <p className="text-xs text-muted-foreground text-pretty line-clamp-2">
                        {issue.description}
                      </p>
                    )}

                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                      {issue.linked_entity_label && (
                        <span className="flex items-center gap-1">
                          <LinkIcon className="size-3" />
                          {issue.linked_entity_label}
                        </span>
                      )}
                      {issue.resolved_by && (
                        <span className="flex items-center gap-1">
                          {issue.resolved_by === "system" ? (
                            <>
                              <Bot className="size-3" />
                              Fixed by system
                            </>
                          ) : (
                            <>
                              <User className="size-3" />
                              Fixed manually
                            </>
                          )}
                        </span>
                      )}
                      <span>
                        {new Date(issue.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    {/* Status dropdown */}
                    <Select
                      value={issue.status}
                      onValueChange={(v) => handleStatusChange(issue.id, v as Issue["status"])}
                    >
                      <SelectTrigger className="h-8 w-[120px] text-xs bg-background/50 border-border/50 rounded-lg">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border-border rounded-lg">
                        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
                          const Icon = cfg.icon;
                          return (
                            <SelectItem key={key} value={key} className="text-xs rounded-lg">
                              <div className="flex items-center gap-2">
                                <Icon className={cn("size-3", cfg.color)} />
                                {cfg.label}
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 rounded-lg"
                      onClick={() => {
                        setEditingIssue(issue);
                        setShowAdd(true);
                      }}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 rounded-lg text-muted-foreground hover:text-red-400"
                      onClick={() => handleDelete(issue.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <IssueDialog
        issue={editingIssue}
        linkableEntities={linkableEntities}
        open={showAdd}
        onClose={() => {
          setShowAdd(false);
          setEditingIssue(null);
        }}
        onSaved={fetchData}
      />
    </PageLayout>
  );
}

function IssueDialog({
  issue,
  linkableEntities,
  open,
  onClose,
  onSaved,
}: {
  issue: Issue | null;
  linkableEntities: LinkableEntity[];
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"bug" | "feature">("bug");
  const [priority, setPriority] = useState<Issue["priority"]>("medium");
  const [linkedEntity, setLinkedEntity] = useState<string>("none");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (issue) {
      setTitle(issue.title);
      setDescription(issue.description || "");
      setType(issue.type);
      setPriority(issue.priority);
      setLinkedEntity(
        issue.linked_entity_type && issue.linked_entity_id
          ? `${issue.linked_entity_type}::${issue.linked_entity_id}`
          : "none"
      );
    } else {
      setTitle("");
      setDescription("");
      setType("bug");
      setPriority("medium");
      setLinkedEntity("none");
    }
  }, [issue, open]);

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);

    let linked_entity_type: Issue["linked_entity_type"] = null;
    let linked_entity_id: string | null = null;
    let linked_entity_label: string | null = null;

    if (linkedEntity !== "none") {
      const [entityType, entityId] = linkedEntity.split("::");
      linked_entity_type = entityType as Issue["linked_entity_type"];
      linked_entity_id = entityId;
      linked_entity_label = linkableEntities.find(
        (e) => e.type === entityType && e.id === entityId
      )?.label || null;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const data = {
      title: title.trim(),
      description: description || null,
      type,
      priority,
      linked_entity_type,
      linked_entity_id,
      linked_entity_label,
      user_id: user?.id,
    };

    if (issue) {
      const { user_id: _, ...updateData } = data;
      await supabase.from("issues").update(updateData).eq("id", issue.id);
    } else {
      await supabase.from("issues").insert({ ...data, status: "open" });
    }

    setSaving(false);
    onClose();
    onSaved();
  };

  // Group linkable entities by type
  const groupedEntities = linkableEntities.reduce<Record<string, LinkableEntity[]>>((acc, e) => {
    const key = e.type || "other";
    if (!acc[key]) acc[key] = [];
    acc[key].push(e);
    return acc;
  }, {});

  const groupLabels: Record<string, string> = {
    page: "Pages",
    workspace: "Workspaces",
    project: "Projects",
    client: "Clients",
    goal: "Goals",
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] bg-card border-border rounded-lg shadow-md">
        <DialogHeader>
          <DialogTitle>{issue ? "Edit Issue" : "New Issue"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* Type toggle */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground uppercase">Type</Label>
            <div className="flex gap-2">
              <button
                onClick={() => setType("bug")}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors border",
                  type === "bug"
                    ? "bg-red-500/10 border-red-500/30 text-red-400"
                    : "bg-muted/30 border-border/50 text-muted-foreground hover:text-foreground"
                )}
              >
                <Bug className="size-4" />
                Bug Report
              </button>
              <button
                onClick={() => setType("feature")}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors border",
                  type === "feature"
                    ? "bg-purple-500/10 border-purple-500/30 text-purple-400"
                    : "bg-muted/30 border-border/50 text-muted-foreground hover:text-foreground"
                )}
              >
                <Lightbulb className="size-4" />
                Feature Request
              </button>
            </div>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground uppercase">Title</Label>
            <Input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                type === "bug"
                  ? "e.g., Calendar events not syncing after midnight"
                  : "e.g., Add dark/light theme toggle"
              }
              className="bg-background/50 border-border/50 rounded-lg"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground uppercase">Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder={
                type === "bug"
                  ? "Steps to reproduce, expected vs actual behavior..."
                  : "What should this feature do? Why is it useful?"
              }
              className="bg-background/50 border-border/50 rounded-lg resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Priority */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase">Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as Issue["priority"])}>
                <SelectTrigger className="bg-background/50 border-border/50 rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border rounded-lg">
                  {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => (
                    <SelectItem key={key} value={key} className="rounded-lg">
                      {cfg.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Linked entity */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase">Linked To</Label>
              <Select value={linkedEntity} onValueChange={(v) => setLinkedEntity(v ?? "none")}>
                <SelectTrigger className="bg-background/50 border-border/50 rounded-lg">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border rounded-lg max-h-[240px]">
                  <SelectItem value="none" className="rounded-lg">
                    None
                  </SelectItem>
                  {Object.entries(groupedEntities).map(([groupKey, entities]) => (
                    <div key={groupKey}>
                      <div className="px-2 py-1.5 text-[10px] font-medium text-muted-foreground uppercase">
                        {groupLabels[groupKey] || groupKey}
                      </div>
                      {entities.map((e) => (
                        <SelectItem
                          key={`${e.type}::${e.id}`}
                          value={`${e.type}::${e.id}`}
                          className="rounded-lg"
                        >
                          {e.label}
                        </SelectItem>
                      ))}
                    </div>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose} className="rounded-lg">
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!title.trim() || saving}
            className="bg-foreground hover:bg-foreground/90 text-background border-0 rounded-lg shadow-md"
          >
            {saving ? "Saving..." : issue ? "Save Changes" : "Create Issue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
