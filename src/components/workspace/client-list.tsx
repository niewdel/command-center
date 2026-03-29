"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Client } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
import { Plus, Pencil, Trash2, ExternalLink, User2 } from "lucide-react";

type ClientListProps = {
  clients: Client[];
  workspaceId: string;
  onRefresh: () => void;
};

export function ClientList({ clients, workspaceId, onRefresh }: ClientListProps) {
  const router = useRouter();
  const params = useParams();
  const slug = params.slug as string;
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);

  const handleDelete = async (id: string) => {
    await supabase.from("clients").delete().eq("id", id);
    onRefresh();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-balance text-xs font-medium text-muted-foreground uppercase">
          Clients ({clients.length})
        </h2>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setEditing(null);
            setShowDialog(true);
          }}
          className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <Plus className="size-3.5" />
          Add Client
        </Button>
      </div>

      {clients.length === 0 ? (
        <div className="text-center py-8">
          <div className="inline-flex size-12 items-center justify-center rounded-2xl bg-muted/50 mb-3">
            <User2 className="size-6 text-muted-foreground" />
          </div>
          <p className="text-pretty text-sm text-muted-foreground">No clients yet</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {clients.map((client) => (
            <div
              key={client.id}
              className="group rounded-lg border border-border/50 bg-card/50 p-4 hover:bg-card hover:border-border transition-colors cursor-pointer"
              onClick={() => router.push(`/workspace/${slug}/client/${client.id}`)}
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold">{client.name}</h3>
                    <span
                      className={cn(
                        "text-[10px] font-medium px-2 py-0.5 rounded-full",
                        client.type === "full"
                          ? "bg-violet-500/20 text-violet-400"
                          : "bg-muted/50 text-muted-foreground"
                      )}
                    >
                      {client.type}
                    </span>
                  </div>
                  {client.notes && (
                    <p className="text-pretty text-xs text-muted-foreground line-clamp-2">
                      {client.notes}
                    </p>
                  )}
                  {client.links && client.links.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {client.links.map((link, i) => (
                        <a
                          key={i}
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                        >
                          <ExternalLink className="size-3" />
                          {link.label}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 rounded-lg"
                    aria-label="Edit client"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditing(client);
                      setShowDialog(true);
                    }}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 rounded-lg text-muted-foreground hover:text-red-400"
                    aria-label="Delete client"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(client.id);
                    }}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ClientDialog
        client={editing}
        workspaceId={workspaceId}
        open={showDialog}
        onClose={() => {
          setShowDialog(false);
          setEditing(null);
        }}
        onSaved={onRefresh}
      />
    </div>
  );
}

function ClientDialog({
  client,
  workspaceId,
  open,
  onClose,
  onSaved,
}: {
  client: Client | null;
  workspaceId: string;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<"full" | "lightweight">("lightweight");
  const [notes, setNotes] = useState("");
  const [linksText, setLinksText] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (client) {
      setName(client.name);
      setType(client.type);
      setNotes(client.notes || "");
      setLinksText(
        client.links
          ? client.links.map((l) => `${l.label}: ${l.url}`).join("\n")
          : ""
      );
    } else {
      setName("");
      setType("lightweight");
      setNotes("");
      setLinksText("");
    }
  }, [client]);

  const parseLinks = (text: string): { label: string; url: string }[] => {
    return text
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => {
        const colonIndex = line.indexOf(":");
        if (colonIndex > 0 && line.includes("//")) {
          return {
            label: line.substring(0, colonIndex).trim(),
            url: line.substring(colonIndex + 1).trim(),
          };
        }
        return { label: line.trim(), url: line.trim() };
      });
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);

    const data = {
      name: name.trim(),
      type,
      notes: notes || null,
      links: linksText.trim() ? parseLinks(linksText) : [],
      workspace_id: workspaceId,
    };

    if (client) {
      await supabase.from("clients").update(data).eq("id", client.id);
    } else {
      await supabase.from("clients").insert(data);
    }

    setSaving(false);
    onClose();
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[460px] bg-card border-border rounded-2xl shadow-md">
        <DialogHeader>
          <DialogTitle>{client ? "Edit Client" : "New Client"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground uppercase">
              Name
            </Label>
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., HD Grading"
              className="bg-background/50 border-border/50 rounded-lg"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground uppercase">
              Type
            </Label>
            <Select value={type} onValueChange={(v) => setType(v as "full" | "lightweight")}>
              <SelectTrigger className="bg-background/50 border-border/50 rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border rounded-lg">
                <SelectItem value="full" className="rounded-lg">Full (notes, links, projects)</SelectItem>
                <SelectItem value="lightweight" className="rounded-lg">Lightweight (tasks + notes)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground uppercase">
              Notes
            </Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Important notes about this client..."
              className="bg-background/50 border-border/50 rounded-lg resize-none"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground uppercase">
              Links (one per line: Label: URL)
            </Label>
            <Textarea
              value={linksText}
              onChange={(e) => setLinksText(e.target.value)}
              rows={3}
              placeholder={"Portal: https://client-portal.com\nDrive: https://drive.google.com/..."}
              className="bg-background/50 border-border/50 rounded-lg resize-none font-mono text-xs"
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose} className="rounded-lg">
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!name.trim() || saving}
            className="bg-foreground text-background hover:bg-foreground/90 border-0 rounded-lg shadow-sm"
          >
            {saving ? "Saving..." : client ? "Save Changes" : "Add Client"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
