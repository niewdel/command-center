"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import type { InboxItem, EmailConnection } from "@/types/database";

export function useInbox() {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [connections, setConnections] = useState<EmailConnection[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchItems = useCallback(async () => {
    const { data, error } = await supabase
      .from("inbox_items")
      .select("*")
      .order("received_at", { ascending: false })
      .limit(100);

    if (!error && data) {
      setItems(data as InboxItem[]);
    }
    setLoading(false);
  }, []);

  const fetchConnections = useCallback(async () => {
    const { data: user } = await supabase.auth.getUser();
    if (!user?.user) return;

    const { data, error } = await supabase
      .from("email_connections")
      .select("*")
      .eq("user_id", user.user.id);

    if (!error && data) {
      setConnections(data as EmailConnection[]);
    }
  }, []);

  useEffect(() => {
    fetchItems();
    fetchConnections();
  }, [fetchItems, fetchConnections]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("inbox_items_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "inbox_items" },
        () => {
          fetchItems();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchItems]);

  const unreadCount = useMemo(
    () => items.filter((item) => !item.is_read).length,
    [items]
  );

  const markAsRead = useCallback(
    async (id: string) => {
      await supabase
        .from("inbox_items")
        .update({ is_read: true, updated_at: new Date().toISOString() })
        .eq("id", id);

      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, is_read: true } : item))
      );
    },
    []
  );

  const toggleStar = useCallback(
    async (id: string) => {
      const item = items.find((i) => i.id === id);
      if (!item) return;

      const newStarred = !item.is_starred;
      await supabase
        .from("inbox_items")
        .update({ is_starred: newStarred, updated_at: new Date().toISOString() })
        .eq("id", id);

      setItems((prev) =>
        prev.map((i) =>
          i.id === id ? { ...i, is_starred: newStarred } : i
        )
      );
    },
    [items]
  );

  return {
    items,
    loading,
    connections,
    unreadCount,
    markAsRead,
    toggleStar,
    refetch: fetchItems,
  };
}
