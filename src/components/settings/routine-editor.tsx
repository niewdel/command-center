"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { RoutineTemplate, RoutineBlock } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatRoutineTime } from "@/lib/routines";
import { cn } from "@/lib/utils";
import {
  Clock,
  Plus,
  Trash2,
  Pencil,
  Check,
  X,
  Sun,
  Moon,
} from "lucide-react";

type BlockFormData = {
  label: string;
  start_time: string;
  end_time: string;
  icon: string;
  color: string;
};

const ROUTINE_ICONS = ["🌅", "🚿", "🍳", "☕", "💼", "🍽️", "🏋️", "📖", "🌙", "😴", "🧘", "🚶"];
const ROUTINE_COLORS = ["#4b5563", "#6366f1", "#8b5cf6", "#ec4899", "#f97316", "#22c55e", "#06b6d4", "#3b82f6"];

export function RoutineEditor() {
  const [templates, setTemplates] = useState<(RoutineTemplate & { blocks: RoutineBlock[] })[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingBlock, setEditingBlock] = useState<string | null>(null);
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [blockForm, setBlockForm] = useState<BlockFormData>({
    label: "",
    start_time: "08:00",
    end_time: "08:30",
    icon: "☕",
    color: "#4b5563",
  });

  const fetchData = useCallback(async () => {
    const { data: tmpl } = await supabase
      .from("routine_templates")
      .select("*")
      .order("position", { ascending: true });

    if (tmpl && tmpl.length > 0) {
      const { data: blocks } = await supabase
        .from("routine_blocks")
        .select("*")
        .in("template_id", tmpl.map((t) => t.id))
        .order("position", { ascending: true });

      setTemplates(
        tmpl.map((t) => ({
          ...t,
          blocks: (blocks || []).filter((b) => b.template_id === t.id),
        }))
      );
    } else {
      setTemplates([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const ensureTemplates = async () => {
    if (templates.length > 0) return;

    const { data: settings } = await supabase
      .from("user_settings")
      .select("user_id")
      .limit(1)
      .single();

    if (!settings?.user_id) return;

    await supabase.from("routine_templates").insert([
      { user_id: settings.user_id, name: "Weekday", day_types: ["weekday"], position: 0 },
      { user_id: settings.user_id, name: "Weekend", day_types: ["weekend"], position: 1 },
    ]);
    await fetchData();
  };

  const handleAddBlock = async (templateId: string) => {
    if (!blockForm.label.trim()) return;

    const template = templates.find((t) => t.id === templateId);
    const maxPos = Math.max(0, ...(template?.blocks.map((b) => b.position) || [0]));

    await supabase.from("routine_blocks").insert({
      template_id: templateId,
      label: blockForm.label.trim(),
      start_time: blockForm.start_time,
      end_time: blockForm.end_time,
      icon: blockForm.icon,
      color: blockForm.color,
      position: maxPos + 1,
    });

    setAddingTo(null);
    setBlockForm({ label: "", start_time: "08:00", end_time: "08:30", icon: "☕", color: "#4b5563" });
    fetchData();
  };

  const handleUpdateBlock = async (blockId: string) => {
    if (!blockForm.label.trim()) return;

    await supabase.from("routine_blocks").update({
      label: blockForm.label.trim(),
      start_time: blockForm.start_time,
      end_time: blockForm.end_time,
      icon: blockForm.icon,
      color: blockForm.color,
    }).eq("id", blockId);

    setEditingBlock(null);
    fetchData();
  };

  const handleDeleteBlock = async (blockId: string) => {
    await supabase.from("routine_blocks").delete().eq("id", blockId);
    fetchData();
  };

  if (loading) return null;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-balance font-heading flex items-center gap-2">
          <Clock className="size-4" />
          Daily Routines
        </h2>
        <p className="text-xs text-muted-foreground mt-1 text-pretty">
          Define your daily structure. Routine blocks show in your calendar and factor into capacity planning.
        </p>
      </div>

      {templates.length === 0 ? (
        <Button
          variant="outline"
          size="sm"
          onClick={ensureTemplates}
          className="gap-1.5 rounded-lg text-xs"
        >
          <Plus className="size-3.5" />
          Set Up Routines
        </Button>
      ) : (
        <div className="space-y-4">
          {templates.map((template) => (
            <div
              key={template.id}
              className="rounded-lg border border-border/50 bg-card/30 overflow-hidden"
            >
              {/* Template header */}
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/30 bg-card/20">
                {template.day_types.includes("weekday") ? (
                  <Sun className="size-3.5 text-amber-400" />
                ) : (
                  <Moon className="size-3.5 text-indigo-400" />
                )}
                <span className="text-sm font-medium">{template.name}</span>
                <span className="text-[11px] text-muted-foreground">
                  {template.blocks.length} block{template.blocks.length !== 1 ? "s" : ""}
                </span>
              </div>

              {/* Blocks */}
              <div className="divide-y divide-border/20">
                {template.blocks.map((block) => (
                  <div key={block.id}>
                    {editingBlock === block.id ? (
                      <BlockForm
                        form={blockForm}
                        onChange={setBlockForm}
                        onSave={() => handleUpdateBlock(block.id)}
                        onCancel={() => setEditingBlock(null)}
                        saveLabel="Save"
                      />
                    ) : (
                      <div className="flex items-center gap-3 px-4 py-2 group hover:bg-card/30 transition-colors">
                        <span className="text-sm">{block.icon}</span>
                        <div
                          className="w-0.5 h-5 rounded-full shrink-0"
                          style={{ backgroundColor: block.color }}
                        />
                        <span className="text-sm font-medium flex-1">{block.label}</span>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {formatRoutineTime(block.start_time)} – {formatRoutineTime(block.end_time)}
                        </span>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => {
                              setEditingBlock(block.id);
                              setBlockForm({
                                label: block.label,
                                start_time: block.start_time,
                                end_time: block.end_time,
                                icon: block.icon || "☕",
                                color: block.color,
                              });
                            }}
                            className="p-1 rounded text-muted-foreground hover:text-foreground"
                            aria-label="Edit block"
                          >
                            <Pencil className="size-3" />
                          </button>
                          <button
                            onClick={() => handleDeleteBlock(block.id)}
                            className="p-1 rounded text-muted-foreground hover:text-red-400"
                            aria-label="Delete block"
                          >
                            <Trash2 className="size-3" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Add block */}
              {addingTo === template.id ? (
                <div className="border-t border-border/20">
                  <BlockForm
                    form={blockForm}
                    onChange={setBlockForm}
                    onSave={() => handleAddBlock(template.id)}
                    onCancel={() => setAddingTo(null)}
                    saveLabel="Add Block"
                  />
                </div>
              ) : (
                <button
                  onClick={() => {
                    setAddingTo(template.id);
                    setBlockForm({ label: "", start_time: "08:00", end_time: "08:30", icon: "☕", color: "#4b5563" });
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-card/30 transition-colors border-t border-border/20"
                >
                  <Plus className="size-3" />
                  Add block
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BlockForm({
  form,
  onChange,
  onSave,
  onCancel,
  saveLabel,
}: {
  form: BlockFormData;
  onChange: (f: BlockFormData) => void;
  onSave: () => void;
  onCancel: () => void;
  saveLabel: string;
}) {
  return (
    <div className="p-3 space-y-3 bg-background/30">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex-1 space-y-1">
          <Label className="text-[10px] text-muted-foreground">Label</Label>
          <Input
            autoFocus
            value={form.label}
            onChange={(e) => onChange({ ...form, label: e.target.value })}
            onKeyDown={(e) => e.key === "Enter" && onSave()}
            placeholder="e.g., Breakfast"
            className="h-8 text-xs bg-background/50 border-border/50 rounded-lg"
          />
        </div>
        <div className="flex gap-2">
          <div className="flex-1 sm:w-[90px] space-y-1">
            <Label className="text-[10px] text-muted-foreground">Start</Label>
            <Input
              type="time"
              value={form.start_time}
              onChange={(e) => onChange({ ...form, start_time: e.target.value })}
              className="h-8 text-xs bg-background/50 border-border/50 rounded-lg"
            />
          </div>
          <div className="flex-1 sm:w-[90px] space-y-1">
            <Label className="text-[10px] text-muted-foreground">End</Label>
            <Input
              type="time"
              value={form.end_time}
              onChange={(e) => onChange({ ...form, end_time: e.target.value })}
              className="h-8 text-xs bg-background/50 border-border/50 rounded-lg"
            />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">Icon</Label>
          <div className="flex gap-1 flex-wrap">
            {ROUTINE_ICONS.map((icon) => (
              <button
                key={icon}
                onClick={() => onChange({ ...form, icon })}
                className={cn(
                  "size-7 rounded text-sm flex items-center justify-center transition-all",
                  form.icon === icon
                    ? "bg-foreground/10 ring-1 ring-foreground/30"
                    : "hover:bg-foreground/5"
                )}
              >
                {icon}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">Color</Label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={form.color}
              onChange={(e) => onChange({ ...form, color: e.target.value })}
              className="size-8 rounded-lg border border-border/50 cursor-pointer bg-transparent p-0.5"
            />
            <div className="flex gap-1">
            {ROUTINE_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => onChange({ ...form, color: c })}
                className={cn(
                  "size-5 rounded-full transition-all",
                  form.color === c
                    ? "ring-2 ring-foreground ring-offset-1 ring-offset-background"
                    : "hover:scale-110"
                )}
                style={{ backgroundColor: c }}
              />
            ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel} className="h-7 text-xs rounded-lg">
          <X className="size-3 mr-1" />
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={onSave}
          disabled={!form.label.trim()}
          className="h-7 text-xs bg-foreground hover:bg-foreground/90 text-background border-0 rounded-lg"
        >
          <Check className="size-3 mr-1" />
          {saveLabel}
        </Button>
      </div>
    </div>
  );
}
