"use client";

import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useOnboarding } from "@/lib/onboarding/useOnboarding";
import { checklistProgress } from "@/lib/onboarding/onboarding-state";
import { CHECKLIST_ITEMS, CHECKLIST_LABEL, type ChecklistKey } from "@/types/onboarding";

// Dismissible activation checklist — 5 items that mark a new account as
// "activated". Hides itself once every item is checked or the user
// dismisses it. Persisted server-side via useOnboarding (RLS-scoped).
export function OnboardingChecklist() {
  const { state, loading, toggleChecklistItem, dismissChecklist } = useOnboarding();

  const { done, total, allDone } = checklistProgress(state.checklist, CHECKLIST_ITEMS);

  if (loading || allDone || state.checklist.dismissed) return null;

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-balance font-heading">Get set up</h2>
          <p className="text-xs text-muted-foreground mt-0.5 text-pretty">
            {done} of {total} done. A few minutes now saves you a lot of guesswork later.
          </p>
        </div>
        <button
          type="button"
          aria-label="Dismiss checklist"
          onClick={dismissChecklist}
          className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-[width]"
          style={{ width: `${(done / total) * 100}%` }}
        />
      </div>

      <ul className="space-y-1.5">
        {CHECKLIST_ITEMS.map((key: ChecklistKey) => {
          const checked = Boolean(state.checklist[key]);
          return (
            <li key={key}>
              <button
                type="button"
                onClick={() => toggleChecklistItem(key)}
                aria-pressed={checked}
                className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent"
              >
                <span
                  className={cn(
                    "flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors",
                    checked ? "bg-primary border-primary" : "border-border"
                  )}
                >
                  {checked && <Check size={11} className="text-primary-foreground" />}
                </span>
                <span className={cn("text-pretty", checked ? "text-muted-foreground line-through" : "text-foreground")}>
                  {CHECKLIST_LABEL[key]}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
