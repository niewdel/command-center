// Server Component shell for the dashboard. Fetches the 9 tables the page
// needs in parallel on the server and ships HTML + data together with the
// first paint. The old all-client implementation forced the browser to
// download JS, hydrate, fire 9 Supabase queries, then render. Now first
// render happens with data already in place; the client island just
// handles interactivity and realtime refresh via router.refresh().

import { createClient } from "@/lib/supabase-server";
import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage() {
  const supabase = await createClient();

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const [
    { data: workspaces },
    { data: tasks },
    { data: settings },
    { data: projects },
    { data: calendarEvents },
    { data: routineTemplates },
    { data: routineBlocks },
    { data: expenses },
    { data: goals },
  ] = await Promise.all([
    supabase.from("workspaces").select("*").order("name"),
    supabase.from("tasks").select("*").order("position", { ascending: true }),
    supabase.from("user_settings").select("*").limit(1).maybeSingle(),
    supabase.from("projects").select("*").order("name"),
    supabase
      .from("calendar_events")
      .select("*")
      .gte("end_time", todayStart.toISOString())
      .lt("start_time", todayEnd.toISOString())
      .neq("status", "cancelled")
      .order("start_time", { ascending: true }),
    supabase.from("routine_templates").select("*").eq("is_active", true).order("position"),
    supabase.from("routine_blocks").select("*").order("position"),
    supabase
      .from("expenses")
      .select("*")
      .not("next_payment_date", "is", null)
      .eq("is_paid", false)
      .order("next_payment_date"),
    supabase.from("goals").select("*").eq("status", "active"),
  ]);

  return (
    <DashboardClient
      initialWorkspaces={workspaces ?? []}
      initialTasks={tasks ?? []}
      initialSettings={settings ?? null}
      initialProjects={projects ?? []}
      initialCalendarEvents={calendarEvents ?? []}
      initialRoutineTemplates={routineTemplates ?? []}
      initialRoutineBlocks={routineBlocks ?? []}
      initialExpenses={expenses ?? []}
      initialGoals={goals ?? []}
    />
  );
}
