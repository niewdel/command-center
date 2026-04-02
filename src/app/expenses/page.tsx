"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Expense, Workspace } from "@/types/database";
import { PageLayout } from "@/components/layout/page-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { DollarSign, Plus, MoreHorizontal, Pencil, Trash2 } from "lucide-react";

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [filterWorkspace, setFilterWorkspace] = useState<string>("all");
  const [showDialog, setShowDialog] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [loading, setLoading] = useState(true);

  // Form state
  const [name, setName] = useState("");
  const [cost, setCost] = useState("");
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [workspaceId, setWorkspaceId] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    const [{ data: exp }, { data: ws }] = await Promise.all([
      supabase.from("expenses").select("*").order("cost", { ascending: false }),
      supabase.from("workspaces").select("*").order("name"),
    ]);
    setExpenses(exp || []);
    setWorkspaces(ws || []);
    if (!workspaceId && ws && ws.length > 0) setWorkspaceId(ws[0].id);
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const workspaceMap = Object.fromEntries(workspaces.map((w) => [w.id, w]));

  const filtered = filterWorkspace === "all"
    ? expenses
    : expenses.filter((e) => e.workspace_id === filterWorkspace);

  // Calculate monthly cost (yearly items ÷ 12)
  const monthlyTotal = filtered.reduce((sum, e) => {
    const c = typeof e.cost === "string" ? parseFloat(e.cost) : e.cost;
    return sum + (e.billing_cycle === "yearly" ? c / 12 : c);
  }, 0);

  const yearlyTotal = monthlyTotal * 12;

  const openAdd = () => {
    setEditingExpense(null);
    setName("");
    setCost("");
    setBillingCycle("monthly");
    setWorkspaceId(workspaces[0]?.id || "");
    setShowDialog(true);
  };

  const openEdit = (expense: Expense) => {
    setEditingExpense(expense);
    setName(expense.name);
    setCost(String(expense.cost));
    setBillingCycle(expense.billing_cycle);
    setWorkspaceId(expense.workspace_id);
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!name.trim() || !cost || !workspaceId) return;
    setSaving(true);

    const data = {
      name: name.trim(),
      cost: parseFloat(cost),
      billing_cycle: billingCycle,
      workspace_id: workspaceId,
      updated_at: new Date().toISOString(),
    };

    if (editingExpense) {
      await supabase.from("expenses").update(data).eq("id", editingExpense.id);
    } else {
      await supabase.from("expenses").insert(data);
    }

    setSaving(false);
    setShowDialog(false);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("expenses").delete().eq("id", id);
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  };

  const formatCost = (amount: number) => {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
  };

  return (
    <PageLayout
      title="Expenses"
      icon={DollarSign}
      loading={loading}
      maxWidth="md"
      actions={
        <Button onClick={openAdd} variant="outline" size="sm" className="gap-1.5 h-8">
          <Plus className="size-3.5" />
          Add
        </Button>
      }
    >
      {/* Monthly total */}
      <div className="rounded border border-border p-4 hud-glow">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Monthly Total</span>
          <span className="text-2xl font-bold font-mono text-primary tabular-nums">
            {formatCost(monthlyTotal)}
            <span className="text-sm text-muted-foreground font-normal">/mo</span>
          </span>
        </div>
      </div>

      {/* Workspace filters */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <button
          onClick={() => setFilterWorkspace("all")}
          className={cn(
            "px-2.5 py-1 rounded text-xs font-medium transition-colors",
            filterWorkspace === "all" ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"
          )}
        >
          All
        </button>
        {workspaces.map((ws) => (
          <button
            key={ws.id}
            onClick={() => setFilterWorkspace(ws.id === filterWorkspace ? "all" : ws.id)}
            className={cn(
              "px-2.5 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1.5",
              filterWorkspace === ws.id ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span
              className={cn("size-2 rounded-full", !ws.color?.startsWith("#") && ws.color)}
              style={ws.color?.startsWith("#") ? { backgroundColor: ws.color } : undefined}
            />
            {ws.name}
          </button>
        ))}
      </div>

      {/* Expense list */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-sm text-muted-foreground">No expenses tracked yet</p>
          <button onClick={openAdd} className="text-sm text-primary hover:underline mt-1">Add your first subscription</button>
        </div>
      ) : (
        <div className="space-y-0">
          {filtered.map((expense) => {
            const ws = workspaceMap[expense.workspace_id];
            const rawCost = typeof expense.cost === "string" ? parseFloat(expense.cost) : expense.cost;
            const monthlyCost = expense.billing_cycle === "yearly" ? rawCost / 12 : rawCost;
            return (
              <div
                key={expense.id}
                className="group flex items-center gap-3 border-b border-border/50 px-2 py-3.5 transition-all hover:bg-primary/[0.05] rounded"
              >
                {/* Workspace dot */}
                {ws && (
                  <span
                    className={cn("size-1.5 rounded-full shrink-0", !ws.color?.startsWith("#") && ws.color)}
                    style={ws.color?.startsWith("#") ? { backgroundColor: ws.color } : undefined}
                  />
                )}

                {/* Name + workspace */}
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => openEdit(expense)}>
                  <span className="text-sm font-medium truncate block">{expense.name}</span>
                  {ws && <span className="text-xs text-muted-foreground">{ws.name}</span>}
                </div>

                {/* Cost */}
                <div className="text-right shrink-0">
                  <span className="text-sm font-mono tabular-nums font-medium">
                    {formatCost(monthlyCost)}
                  </span>
                  <span className="text-xs text-muted-foreground">/mo</span>
                  {expense.billing_cycle === "yearly" && (
                    <p className="text-[10px] text-muted-foreground font-mono tabular-nums">
                      {formatCost(rawCost)}/yr
                    </p>
                  )}
                </div>

                {/* Actions */}
                <DropdownMenu>
                  <DropdownMenuTrigger
                    className={cn(
                      "inline-flex items-center justify-center size-7 shrink-0 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors",
                      "opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 transition-opacity"
                    )}
                    aria-label="Actions"
                  >
                    <MoreHorizontal className="size-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-32">
                    <DropdownMenuItem onClick={() => openEdit(expense)}>
                      <Pencil className="size-3.5 mr-2" />Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleDelete(expense.id)} className="text-red-400 focus:text-red-400">
                      <Trash2 className="size-3.5 mr-2" />Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          })}

          {/* Footer totals */}
          <div className="flex items-center justify-between pt-4 px-1">
            <span className="text-xs text-muted-foreground">{filtered.length} subscription{filtered.length !== 1 ? "s" : ""}</span>
            <div className="text-right">
              <span className="text-sm font-mono tabular-nums font-semibold text-primary">{formatCost(monthlyTotal)}/mo</span>
              <span className="text-xs text-muted-foreground ml-2 font-mono tabular-nums">({formatCost(yearlyTotal)}/yr)</span>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-[400px] bg-card border-border rounded shadow-md">
          <DialogHeader>
            <DialogTitle>{editingExpense ? "Edit Expense" : "Add Expense"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Claude Pro" className="bg-card border-border rounded" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Cost</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                  <Input type="number" step="0.01" min="0" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0.00" className="bg-card border-border rounded pl-7 font-mono" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Billing</Label>
                <div className="flex gap-1">
                  <button onClick={() => setBillingCycle("monthly")} className={cn("flex-1 px-3 py-2 rounded text-xs font-medium transition-colors", billingCycle === "monthly" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground")}>Monthly</button>
                  <button onClick={() => setBillingCycle("yearly")} className={cn("flex-1 px-3 py-2 rounded text-xs font-medium transition-colors", billingCycle === "yearly" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground")}>Yearly</button>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Workspace</Label>
              <select value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)} className="w-full h-9 rounded border border-border bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring">
                {workspaces.map((ws) => (<option key={ws.id} value={ws.id}>{ws.name}</option>))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowDialog(false)} className="rounded">Cancel</Button>
            <Button onClick={handleSave} disabled={!name.trim() || !cost || saving} className="bg-primary hover:bg-primary/90 text-primary-foreground border-0 rounded">
              {saving ? "Saving..." : editingExpense ? "Save" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
}
