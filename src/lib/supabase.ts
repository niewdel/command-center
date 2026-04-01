import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// Singleton for client-side use (backwards-compatible with existing code)
export const supabase = createClient();

// Get the single user's ID (PIN-auth app — no Supabase Auth session)
let cachedUserId: string | null = null;
export async function getUserId(): Promise<string | null> {
  if (cachedUserId) return cachedUserId;
  const { data } = await supabase
    .from("user_settings")
    .select("user_id")
    .limit(1)
    .single();
  cachedUserId = data?.user_id ?? null;
  return cachedUserId;
}
