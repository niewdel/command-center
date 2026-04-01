"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  User,
  Plus,
  ChevronRight,
  Lock,
  Target,
  CalendarDays,
  Calendar,
  Settings,
  FileText,
  BookOpen,
  Bug,
  Zap,
  Briefcase,
  Building,
  Folder,
  Pencil,
  Trash2,
  Upload,
  ImageIcon,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Workspace } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { QuickAddDialog } from "@/components/layout/quick-add-dialog";

const ICON_MAP: Record<string, typeof Briefcase> = {
  briefcase: Briefcase,
  building: Building,
  user: User,
  folder: Folder,
  target: Target,
};

function getWorkspaceIcon(iconName: string) {
  return ICON_MAP[iconName] || Briefcase;
}

const extraNav = [
  { name: "Dump", href: "/dump", icon: Zap },
  { name: "Upcoming", href: "/upcoming", icon: CalendarDays },
  { name: "Digests", href: "/digests", icon: BookOpen },
  { name: "Issues", href: "/issues", icon: Bug },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [showWorkspaceDialog, setShowWorkspaceDialog] = useState(false);
  const [editingWorkspace, setEditingWorkspace] = useState<Workspace | null>(null);

  const fetchWorkspaces = useCallback(async () => {
    const { data } = await supabase
      .from("workspaces")
      .select("*")
      .order("position", { ascending: true });
    setWorkspaces(data || []);
  }, []);

  useEffect(() => {
    fetchWorkspaces();

    const channel = supabase
      .channel("workspaces-sidebar")
      .on("postgres_changes", { event: "*", schema: "public", table: "workspaces" }, () => fetchWorkspaces())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchWorkspaces]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "n") {
      e.preventDefault();
      setQuickAddOpen(true);
    }
  }, []);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const handleLock = () => {
    document.cookie = "cc-auth=; path=/; max-age=0";
    router.push("/login");
    router.refresh();
  };

  const isDashboardActive = pathname === "/dashboard";

  return (
    <>
      {/* Sidebar — desktop only */}
      <aside data-slot="sidebar" className="hidden md:flex fixed inset-y-0 left-0 z-40 w-[var(--sidebar-width)] flex-col bg-sidebar border-r border-sidebar-border">
        {/* Header */}
        <div className="flex items-center px-4 py-3 border-b border-sidebar-border">
          <div className="flex items-center gap-2.5">
            <div className="size-7 rounded-md bg-foreground flex items-center justify-center">
              <span className="text-background font-bold text-xs">CC</span>
            </div>
            <h1 className="text-sm font-semibold text-foreground font-heading">Command Center</h1>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {/* Dashboard */}
          <Link
            href="/dashboard"
            className={cn(
              "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
              isDashboardActive
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
            )}
          >
            <LayoutDashboard className="size-4 shrink-0" />
            <span>Today</span>
          </Link>

          {/* Dynamic Workspaces */}
          <div className="pt-3">
            <div className="flex items-center justify-between px-2.5 mb-1.5">
              <p className="text-[11px] font-medium uppercase text-muted-foreground">
                Workspaces
              </p>
              <button
                aria-label="Add workspace"
                onClick={() => {
                  setEditingWorkspace(null);
                  setShowWorkspaceDialog(true);
                }}
                className="p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors"
              >
                <Plus className="size-3.5" />
              </button>
            </div>
            {workspaces.map((ws) => {
              const isActive = pathname === `/workspace/${ws.slug}` || pathname.startsWith(`/workspace/${ws.slug}/`);
              return (
                <div key={ws.id} className="group/ws relative">
                  <Link
                    href={`/workspace/${ws.slug}`}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-accent text-foreground"
                        : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                    )}
                  >
                    <span
                      className={cn("size-2 rounded-full shrink-0", !ws.color?.startsWith("#") && (ws.color || "bg-muted-foreground"))}
                      style={ws.color?.startsWith("#") ? { backgroundColor: ws.color } : undefined}
                    />
                    <span className="flex-1 truncate">{ws.name}</span>
                  </Link>
                  <button
                    aria-label={`Edit ${ws.name}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingWorkspace(ws);
                      setShowWorkspaceDialog(true);
                    }}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded text-muted-foreground hover:text-foreground opacity-0 group-hover/ws:opacity-100 transition-opacity"
                  >
                    <Pencil className="size-3" />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Planning section */}
          <div className="pt-3">
            <p className="px-2.5 mb-1.5 text-[11px] font-medium uppercase text-muted-foreground">
              Tools
            </p>
            {extraNav.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                  )}
                >
                  <item.icon className="size-4 shrink-0" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Bottom actions */}
        <div className="p-3 border-t border-sidebar-border space-y-1.5">
          <Button
            variant="outline"
            onClick={() => setQuickAddOpen(true)}
            className="w-full gap-2 rounded-md h-9 text-sm font-medium"
            size="sm"
          >
            <Plus className="size-4" />
            Quick Add
            <kbd className="ml-auto text-[10px] opacity-50 px-1.5 py-0.5 rounded bg-muted">
              {typeof navigator !== "undefined" && /Mac/.test(navigator.userAgent) ? "⌘" : "Ctrl+"}N
            </kbd>
          </Button>
          <button
            onClick={handleLock}
            className="w-full flex items-center justify-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
          >
            <Lock className="size-3.5" />
            Lock
          </button>
        </div>
      </aside>

      {/* Quick Add Dialog */}
      <QuickAddDialog open={quickAddOpen} onClose={() => setQuickAddOpen(false)} />

      {/* Workspace Create/Edit Dialog */}
      <WorkspaceDialog
        workspace={editingWorkspace}
        open={showWorkspaceDialog}
        onClose={() => {
          setShowWorkspaceDialog(false);
          setEditingWorkspace(null);
        }}
        onSaved={fetchWorkspaces}
      />
    </>
  );
}

// --- Workspace Create/Edit Dialog ---

const PRESET_COLORS = [
  "#64748b", "#ef4444", "#f97316", "#f59e0b",
  "#10b981", "#14b8a6", "#06b6d4", "#3b82f6",
  "#6366f1", "#8b5cf6", "#a855f7", "#ec4899", "#f43f5e",
];

const ICON_OPTIONS = [
  { value: "briefcase", label: "Briefcase" },
  { value: "building", label: "Building" },
  { value: "user", label: "Person" },
  { value: "folder", label: "Folder" },
  { value: "target", label: "Target" },
];

function WorkspaceDialog({
  workspace,
  open,
  onClose,
  onSaved,
}: {
  workspace: Workspace | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [type, setType] = useState<"business" | "personal">("business");
  const [color, setColor] = useState("bg-slate-500");
  const [icon, setIcon] = useState("briefcase");
  const [description, setDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (workspace) {
      setName(workspace.name);
      setType(workspace.type);
      setColor(workspace.color || "#64748b");
      setIcon(workspace.icon || "briefcase");
      setDescription(workspace.description || "");
      setLogoUrl(workspace.logo_url);
      setLogoFile(null);
      setLogoPreview(null);
      setConfirmDelete(false);
    } else {
      setName("");
      setType("business");
      setColor("#64748b");
      setIcon("briefcase");
      setDescription("");
      setLogoUrl(null);
      setLogoFile(null);
      setLogoPreview(null);
      setConfirmDelete(false);
    }
  }, [workspace, open]);

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const uploadLogo = async (workspaceSlug: string): Promise<string | null> => {
    if (!logoFile) return logoUrl;
    setUploading(true);

    const ext = logoFile.name.split(".").pop() || "png";
    const path = `workspace-logos/${workspaceSlug}.${ext}`;

    const { error } = await supabase.storage
      .from("workspace-assets")
      .upload(path, logoFile, { upsert: true });

    setUploading(false);

    if (error) {
      console.error("Logo upload failed:", error);
      return logoUrl;
    }

    const { data } = supabase.storage.from("workspace-assets").getPublicUrl(path);
    // Cache-bust so the browser fetches the new image
    return `${data.publicUrl}?t=${Date.now()}`;
  };

  const removeLogo = () => {
    setLogoUrl(null);
    setLogoFile(null);
    setLogoPreview(null);
  };

  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);

    const uploadedLogoUrl = await uploadLogo(slug);

    const data = {
      name: name.trim(),
      slug,
      type,
      color,
      icon,
      description: description || null,
      logo_url: uploadedLogoUrl,
    };

    if (workspace) {
      await supabase.from("workspaces").update(data).eq("id", workspace.id);
    } else {
      await supabase.from("workspaces").insert(data);
    }

    setSaving(false);
    onClose();
    onSaved();
  };

  const handleDelete = async () => {
    if (!workspace) return;
    await supabase.from("workspaces").delete().eq("id", workspace.id);
    onClose();
    onSaved();
    router.push("/dashboard");
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[440px] bg-card border-border rounded-lg shadow-md">
        <DialogHeader>
          <DialogTitle>{workspace ? "Edit Workspace" : "New Workspace"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Acme Corp"
              className="bg-background/50 border-border/50 rounded-lg"
            />
            {name && (
              <p className="text-[11px] text-muted-foreground text-pretty">
                Slug: <span className="font-mono text-foreground">{slug}</span>
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this workspace for?"
              className="bg-background/50 border-border/50 rounded-lg"
            />
          </div>

          <div className="space-y-2">
            <Label>Logo</Label>
            <div className="flex items-center gap-3">
              {/* Preview */}
              <div
                className={cn("size-12 rounded-lg flex items-center justify-center shrink-0 overflow-hidden", logoPreview || logoUrl ? "bg-muted" : (!color.startsWith("#") && color))}
                style={!logoPreview && !logoUrl && color.startsWith("#") ? { backgroundColor: color } : undefined}
              >
                {logoPreview ? (
                  <img src={logoPreview} alt="Preview" className="size-12 object-cover rounded-lg" />
                ) : logoUrl ? (
                  <img src={logoUrl} alt="Logo" className="size-12 object-cover rounded-lg" />
                ) : (
                  <ImageIcon className="size-5 text-white/60" />
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted hover:bg-accent text-xs font-medium text-foreground transition-colors">
                  <Upload className="size-3" />
                  {logoUrl || logoPreview ? "Change" : "Upload"}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoSelect}
                    className="hidden"
                  />
                </label>
                {(logoUrl || logoPreview) && (
                  <button
                    onClick={removeLogo}
                    className="text-[11px] text-muted-foreground hover:text-red-400 transition-colors text-left"
                  >
                    Remove logo
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as "business" | "personal")}>
                <SelectTrigger className="bg-background/50 border-border/50 rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border rounded-lg">
                  <SelectItem value="business" className="rounded-lg">Business</SelectItem>
                  <SelectItem value="personal" className="rounded-lg">Personal</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Icon</Label>
              <Select value={icon} onValueChange={(v) => v && setIcon(v)}>
                <SelectTrigger className="bg-background/50 border-border/50 rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border rounded-lg">
                  {ICON_OPTIONS.map((opt) => {
                    const IconComp = ICON_MAP[opt.value] || Briefcase;
                    return (
                      <SelectItem key={opt.value} value={opt.value} className="rounded-lg">
                        <div className="flex items-center gap-2">
                          <IconComp className="size-3.5" />
                          {opt.label}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex items-center gap-3">
              <div className="flex gap-1.5 flex-wrap flex-1">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={cn(
                      "size-6 rounded-md transition-all",
                      color === c ? "ring-2 ring-foreground ring-offset-2 ring-offset-background scale-110" : "opacity-60 hover:opacity-100"
                    )}
                    style={{ backgroundColor: c }}
                    aria-label={c}
                  />
                ))}
              </div>
              <label className="relative shrink-0 cursor-pointer" title="Custom color">
                <div
                  className="size-8 rounded-md border border-border"
                  style={{ backgroundColor: color.startsWith("#") ? color : "#64748b" }}
                />
                <input
                  type="color"
                  value={color.startsWith("#") ? color : "#64748b"}
                  onChange={(e) => setColor(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              </label>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          {workspace && (
            <div className="mr-auto">
              {confirmDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-red-400">Delete workspace and all data?</span>
                  <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)} className="h-7 text-xs rounded-lg">
                    Cancel
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDelete}
                    className="h-7 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg"
                  >
                    Confirm
                  </Button>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmDelete(true)}
                  className="h-7 text-xs text-muted-foreground hover:text-red-400 rounded-lg gap-1"
                >
                  <Trash2 className="size-3" />
                  Delete
                </Button>
              )}
            </div>
          )}
          <Button variant="ghost" onClick={onClose} className="rounded-lg">
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!name.trim() || saving}
            className="bg-foreground text-background hover:bg-foreground/90 border-0 rounded-lg"
          >
            {saving ? "Saving..." : workspace ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
