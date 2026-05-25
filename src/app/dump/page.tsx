// Server Component shell. Fetches initial recent AI-filed tasks on the
// server and ships them to the browser with the first paint, so the user
// doesn't see an empty list while a client-side query rolls back from
// Supabase. Workspaces still come from the AppShell-level provider on the
// client (it owns realtime subscription for that table).

import { createClient } from "@/lib/supabase-server";
import { PageLayout } from "@/components/layout/page-layout";
import { Zap } from "lucide-react";
import { DumpClient, type DumpResult } from "./dump-client";

function extractResearch(description: string): string {
  const match = description.match(/\*\*AI Research & Tips:\*\*\n([\s\S]*)/);
  return match?.[1]?.trim() || "";
}

export default async function DumpPage() {
  const supabase = await createClient();
  const { data: tasks } = await supabase
    .from("tasks")
    .select(
      "id, title, priority, description, estimated_minutes, workspace_id, created_at, workspaces(name)",
    )
    .eq("source", "ai")
    .order("created_at", { ascending: false })
    .limit(20);

  const recentTasks: DumpResult[] = (tasks ?? []).map((t) => ({
    id: t.id,
    title: t.title,
    workspace_id: t.workspace_id,
    workspace_name:
      (t.workspaces as unknown as { name: string } | null)?.name || "Unknown",
    priority: t.priority,
    research: extractResearch(t.description || ""),
    estimated_minutes: t.estimated_minutes,
    timestamp: new Date(t.created_at).getTime(),
  }));

  return (
    <PageLayout
      title="Task Dump"
      eyebrow="Capture · Inbox"
      description="Throw tasks in. AI sorts them."
      icon={Zap}
      maxWidth="md"
    >
      <DumpClient initialRecent={recentTasks} />
    </PageLayout>
  );
}
