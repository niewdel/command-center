"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { ChecklistKey, OnboardingChecklist, OnboardingState } from "@/types/onboarding";
import {
  DEFAULT_ONBOARDING_STATE,
  advanceState,
  completeState,
  dismissChecklistState,
  shouldStartTour,
  stateFromRow,
  toggleChecklistItemState,
} from "@/lib/onboarding/onboarding-state";

type UserOnboardingRow = {
  user_id: string;
  onboarding_completed_at: string | null;
  onboarding_step: number;
  onboarding_checklist: OnboardingChecklist | null;
};

// Minimal, structural shape of the pieces of the Supabase client this hook
// depends on — lets tests pass a fake client without pulling in the real
// supabase-js types. `PromiseLike` (not `Promise`) so the real PostgREST
// builder (which is thenable but isn't a full `Promise`) is still assignable.
export type OnboardingSupabaseClient = {
  auth: { getUser: () => PromiseLike<{ data: { user: { id: string } | null } }> };
  from: (table: string) => {
    select: (cols: string) => {
      eq: (
        col: string,
        val: string
      ) => { maybeSingle: () => PromiseLike<{ data: UserOnboardingRow | null; error: { message: string } | null }> };
    };
    upsert: (
      row: Record<string, unknown>,
      opts: { onConflict: string }
    ) => PromiseLike<{ error: { message: string } | null }>;
  };
};

// Cast once, outside the function signature — comparing the full (deeply
// generic) SupabaseClient type against this structural interface inline in
// a default-parameter position trips TS2589 (excessively deep instantiation).
const defaultClient = supabase as unknown as OnboardingSupabaseClient;

/**
 * Fetches (or lazily creates) the signed-in user's onboarding row. Extracted
 * from the hook so the Supabase round-trip can be tested directly with a
 * mocked client, without rendering React.
 */
export async function loadOnboarding(
  client: OnboardingSupabaseClient
): Promise<{ userId: string | null; state: OnboardingState }> {
  const { data: userData } = await client.auth.getUser();
  const uid = userData.user?.id ?? null;
  if (!uid) return { userId: null, state: DEFAULT_ONBOARDING_STATE };

  const { data, error } = await client.from("user_onboarding").select("*").eq("user_id", uid).maybeSingle();

  if (!error && data) {
    return { userId: uid, state: stateFromRow(data) };
  }

  // No row yet — create one so subsequent writes are updates, not races
  // with a first insert.
  await client.from("user_onboarding").upsert({ user_id: uid }, { onConflict: "user_id" });
  return { userId: uid, state: DEFAULT_ONBOARDING_STATE };
}

/** Upserts a partial onboarding patch for the given user. */
export async function persistOnboarding(
  client: OnboardingSupabaseClient,
  userId: string,
  patch: Partial<Omit<UserOnboardingRow, "user_id">>
): Promise<void> {
  await client.from("user_onboarding").upsert({ user_id: userId, ...patch }, { onConflict: "user_id" });
}

export function useOnboarding(client: OnboardingSupabaseClient = defaultClient) {
  const [state, setState] = useState<OnboardingState>(DEFAULT_ONBOARDING_STATE);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [tourOpen, setTourOpen] = useState(false);
  const [tourForced, setTourForced] = useState(false);

  const load = useCallback(async () => {
    const { userId: uid, state: loaded } = await loadOnboarding(client);
    setUserId(uid);
    setState(loaded);
    setLoading(false);
  }, [client]);

  useEffect(() => {
    void load();
  }, [load]);

  const persist = useCallback(
    async (patch: Partial<Omit<UserOnboardingRow, "user_id">>) => {
      if (!userId) return;
      await persistOnboarding(client, userId, patch);
    },
    [client, userId]
  );

  // Auto-start (first login) skips if already completed; replay from
  // Settings passes force:true to ignore that flag.
  const startTour = useCallback(
    (force = false) => {
      if (!shouldStartTour(state, force)) return;
      setTourForced(force);
      setTourOpen(true);
    },
    [state]
  );

  const closeTour = useCallback(() => setTourOpen(false), []);

  const advance = useCallback(
    (step: number) => {
      setState((s) => advanceState(s, step));
      void persist({ onboarding_step: step });
    },
    [persist]
  );

  const complete = useCallback(() => {
    const now = new Date().toISOString();
    setState((s) => completeState(s, now));
    setTourOpen(false);
    void persist({ onboarding_completed_at: now });
  }, [persist]);

  const toggleChecklistItem = useCallback(
    (key: ChecklistKey) => {
      setState((s) => {
        const next = toggleChecklistItemState(s, key);
        void persist({ onboarding_checklist: next.checklist });
        return next;
      });
    },
    [persist]
  );

  const dismissChecklist = useCallback(() => {
    setState((s) => {
      const next = dismissChecklistState(s);
      void persist({ onboarding_checklist: next.checklist });
      return next;
    });
  }, [persist]);

  return {
    state,
    loading,
    tourOpen,
    tourForced,
    startTour,
    closeTour,
    advance,
    complete,
    toggleChecklistItem,
    dismissChecklist,
  };
}
