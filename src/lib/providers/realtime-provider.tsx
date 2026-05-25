"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

type TableName = string;
type Listener = () => void;

type RealtimeBus = {
  /** Subscribe to any postgres_changes on a table. Returns an unsubscribe fn. */
  subscribe: (table: TableName, listener: Listener) => () => void;
};

const RealtimeContext = createContext<RealtimeBus | null>(null);

/**
 * App-wide realtime hub. One channel per Postgres table, owned by AppShell
 * for the lifetime of the session. Pages register listeners via `useRealtime`;
 * the channel stays open while any page has at least one listener, and is
 * torn down once the last listener detaches.
 *
 * Replaces the prior pattern where every page created its own channel on
 * mount and removed it on unmount, leading to constant subscribe/unsubscribe
 * churn on navigation and duplicate channels when two pages watched the same
 * table.
 */
export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  // For each table, we keep one channel and a Set of listener callbacks.
  // useRef because we don't want renders triggered when the registry mutates.
  const registry = useRef<
    Map<TableName, { channel: RealtimeChannel; listeners: Set<Listener> }>
  >(new Map());

  const subscribe = useCallback((table: TableName, listener: Listener) => {
    let entry = registry.current.get(table);
    if (!entry) {
      const channel = supabase
        .channel(`app-rt-${table}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table },
          () => {
            const cur = registry.current.get(table);
            if (!cur) return;
            cur.listeners.forEach((l) => l());
          },
        )
        .subscribe();
      entry = { channel, listeners: new Set() };
      registry.current.set(table, entry);
    }
    entry.listeners.add(listener);

    return () => {
      const cur = registry.current.get(table);
      if (!cur) return;
      cur.listeners.delete(listener);
      if (cur.listeners.size === 0) {
        supabase.removeChannel(cur.channel);
        registry.current.delete(table);
      }
    };
  }, []);

  // Clean up everything on unmount (HMR / sign-out)
  useEffect(() => {
    const reg = registry.current;
    return () => {
      reg.forEach(({ channel }) => supabase.removeChannel(channel));
      reg.clear();
    };
  }, []);

  const value = useMemo<RealtimeBus>(() => ({ subscribe }), [subscribe]);

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

/**
 * Subscribe to realtime changes on a Postgres table. `onChange` fires for
 * any insert/update/delete. Safe to use from any client component; the
 * underlying channel is shared across all subscribers of the same table.
 */
export function useRealtime(table: TableName, onChange: () => void) {
  const ctx = useContext(RealtimeContext);
  // Use a ref so the effect doesn't re-subscribe when callers pass an
  // inline arrow function. The latest onChange is always what fires.
  const cbRef = useRef(onChange);
  useEffect(() => {
    cbRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!ctx) return;
    const unsub = ctx.subscribe(table, () => cbRef.current());
    return unsub;
  }, [ctx, table]);
}
