"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Workspace } from "@/types/database";

type WorkspacesContextValue = {
  workspaces: Workspace[];
  loading: boolean;
  refetch: () => Promise<void>;
};

const WorkspacesContext = createContext<WorkspacesContextValue>({
  workspaces: [],
  loading: true,
  refetch: async () => {},
});

/**
 * App-wide workspaces source. Before this provider, sidebar + bottom-nav +
 * every page that needed workspaces fired its own `supabase.from("workspaces")`
 * query on mount and each had its own realtime channel. That meant 3+ identical
 * queries and 2 redundant subscriptions per cold load. Centralizing kills that
 * duplication and gives the rest of the app a single source of truth.
 */
export function WorkspacesProvider({
  initial,
  children,
}: {
  initial?: Workspace[];
  children: React.ReactNode;
}) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>(initial ?? []);
  const [loading, setLoading] = useState(!initial);

  const fetchWorkspaces = useCallback(async () => {
    const { data } = await supabase
      .from("workspaces")
      .select("*")
      .order("position", { ascending: true });
    setWorkspaces(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!initial) {
      fetchWorkspaces();
    }
    const channel = supabase
      .channel("app-workspaces")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "workspaces" },
        () => fetchWorkspaces(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchWorkspaces, initial]);

  return (
    <WorkspacesContext.Provider value={{ workspaces, loading, refetch: fetchWorkspaces }}>
      {children}
    </WorkspacesContext.Provider>
  );
}

export function useWorkspaces() {
  return useContext(WorkspacesContext);
}
