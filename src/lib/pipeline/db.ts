import { createClient, SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function getPipelineClient(): SupabaseClient {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    }
    client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

// Cache the Niewdel workspace_id for the request lifetime. Slug is the
// stable identifier; id is what every CRM table is keyed by.
let workspaceIdCache: { slug: string; id: string }[] = [];

export async function getWorkspaceIdBySlug(slug: string): Promise<string | null> {
  const hit = workspaceIdCache.find((w) => w.slug === slug);
  if (hit) return hit.id;
  const { data } = await getPipelineClient()
    .from("workspaces")
    .select("id, slug")
    .eq("slug", slug)
    .maybeSingle();
  if (!data) return null;
  workspaceIdCache.push({ slug: data.slug, id: data.id });
  return data.id as string;
}

// Default workspace for the pipeline — Niewdel for now. Future: derive from
// the authenticated session / route param.
export async function getDefaultPipelineWorkspaceId(): Promise<string> {
  const id = await getWorkspaceIdBySlug("niewdel");
  if (!id) throw new Error("Niewdel workspace not found");
  return id;
}
