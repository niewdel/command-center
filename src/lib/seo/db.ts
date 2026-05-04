import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type {
  SeoJobStatus,
  SeoJobType,
  SeoIssueDraft,
  SeoIssueStatus,
  PageSnapshot,
  CheckScores,
} from "./types";
import {
  SEO_JOB_HEARTBEAT_TIMEOUT_MS,
  NON_TERMINAL_SEO_STATUSES,
} from "./types";

let client: SupabaseClient | null = null;

export function getServiceClient(): SupabaseClient {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error(
        "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
      );
    }
    client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

// ============================================================
// seo_jobs
// ============================================================

export interface SeoJobRow {
  id: string;
  workspace_id: string;
  client_id: string;
  type: SeoJobType;
  status: SeoJobStatus;
  current_stage: string | null;
  progress_pct: number;
  triggered_by: string | null;
  scheduled_for: string | null;
  started_at: string | null;
  completed_at: string | null;
  last_heartbeat_at: string | null;
  error_message: string | null;
  result_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export type SeoJobUpdate = Partial<{
  status: SeoJobStatus;
  current_stage: string;
  progress_pct: number;
  error_message: string;
  result_id: string;
  metadata: Record<string, unknown>;
  started_at: string;
  completed_at: string;
}>;

export async function createSeoJob(input: {
  workspace_id: string;
  client_id: string;
  type: SeoJobType;
  triggered_by?: string | null;
  scheduled_for?: string | null;
}): Promise<SeoJobRow> {
  const sb = getServiceClient();
  const { data, error } = await sb
    .from("seo_jobs")
    .insert({
      workspace_id: input.workspace_id,
      client_id: input.client_id,
      type: input.type,
      triggered_by: input.triggered_by ?? null,
      scheduled_for: input.scheduled_for ?? null,
      last_heartbeat_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw new Error(`Failed to create seo_job: ${error.message}`);
  return data as SeoJobRow;
}

export async function updateSeoJob(jobId: string, patch: SeoJobUpdate) {
  const { error } = await getServiceClient()
    .from("seo_jobs")
    .update({ last_heartbeat_at: new Date().toISOString(), ...patch })
    .eq("id", jobId);
  if (error) throw new Error(`Failed to update seo_job: ${error.message}`);
}

export async function getSeoJob(jobId: string): Promise<SeoJobRow | null> {
  const { data } = await getServiceClient()
    .from("seo_jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle();
  return (data as SeoJobRow) ?? null;
}

/**
 * Mark any non-terminal seo_jobs whose heartbeat is older than
 * SEO_JOB_HEARTBEAT_TIMEOUT_MS as failed. Returns swept ids.
 */
export async function sweepStaleSeoJobs(): Promise<string[]> {
  const cutoff = new Date(
    Date.now() - SEO_JOB_HEARTBEAT_TIMEOUT_MS
  ).toISOString();
  const sb = getServiceClient();
  const { data, error } = await sb
    .from("seo_jobs")
    .update({
      status: "failed" as SeoJobStatus,
      error_message:
        "Worker process died mid-run (no heartbeat). Re-run the job.",
      completed_at: new Date().toISOString(),
    })
    .in("status", NON_TERMINAL_SEO_STATUSES)
    .lt("last_heartbeat_at", cutoff)
    .select("id");
  if (error) throw new Error(`Failed to sweep seo_jobs: ${error.message}`);
  return (data ?? []).map((r) => r.id as string);
}

// ============================================================
// seo_checks
// ============================================================

export async function insertSeoCheck(input: {
  job_id: string;
  workspace_id: string;
  client_id: string;
  scores: CheckScores;
  pages: PageSnapshot[];
  diff_from_previous?: Record<string, unknown> | null;
  ai_summary?: string | null;
}): Promise<{ id: string }> {
  const sb = getServiceClient();
  const { data, error } = await sb
    .from("seo_checks")
    .insert({
      job_id: input.job_id,
      workspace_id: input.workspace_id,
      client_id: input.client_id,
      technical_score: input.scores.technical,
      lighthouse_mobile: input.scores.lighthouse_mobile,
      lighthouse_desktop: input.scores.lighthouse_desktop,
      onpage_score: input.scores.onpage,
      freshness_days: input.scores.freshness_days,
      pages_crawled: input.pages.length,
      pages: input.pages,
      diff_from_previous: input.diff_from_previous ?? null,
      ai_summary: input.ai_summary ?? null,
    })
    .select("id")
    .single();
  if (error) throw new Error(`Failed to insert seo_check: ${error.message}`);
  return data as { id: string };
}

export async function getLatestSeoCheck(clientId: string) {
  const { data } = await getServiceClient()
    .from("seo_checks")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

// ============================================================
// seo_issues
// ============================================================

/**
 * Upsert a draft issue keyed by (client_id, fingerprint) where status='open'.
 * If an open issue with the same fingerprint exists, bumps last_seen_*.
 * If it doesn't, inserts it as new (sets first_seen_* + last_seen_*).
 */
export async function upsertOpenIssue(
  clientId: string,
  workspaceId: string,
  checkId: string,
  draft: SeoIssueDraft
): Promise<{ id: string; isNew: boolean }> {
  const sb = getServiceClient();

  const { data: existing } = await sb
    .from("seo_issues")
    .select("id")
    .eq("client_id", clientId)
    .eq("fingerprint", draft.fingerprint)
    .eq("status", "open")
    .maybeSingle();

  if (existing) {
    const { error } = await sb
      .from("seo_issues")
      .update({
        last_seen_check_id: checkId,
        last_seen_at: new Date().toISOString(),
        // refresh title/desc/recommendation in case wording improved
        title: draft.title,
        description: draft.description ?? null,
        recommendation: draft.recommendation ?? null,
        severity: draft.severity,
      })
      .eq("id", existing.id);
    if (error) throw new Error(`Failed to update seo_issue: ${error.message}`);
    return { id: existing.id as string, isNew: false };
  }

  const { data, error } = await sb
    .from("seo_issues")
    .insert({
      workspace_id: workspaceId,
      client_id: clientId,
      fingerprint: draft.fingerprint,
      severity: draft.severity,
      category: draft.category,
      sub_type: draft.sub_type,
      page_url: draft.page_url ?? null,
      title: draft.title,
      description: draft.description ?? null,
      recommendation: draft.recommendation ?? null,
      first_seen_check_id: checkId,
      last_seen_check_id: checkId,
    })
    .select("id")
    .single();
  if (error) throw new Error(`Failed to insert seo_issue: ${error.message}`);
  return { id: (data as { id: string }).id, isNew: true };
}

/**
 * Mark issues as 'fixed' when their fingerprints didn't appear in the latest
 * check. Returns count of resolved issues.
 */
export async function resolveMissingIssues(
  clientId: string,
  checkId: string,
  observedFingerprints: Set<string>
): Promise<number> {
  const sb = getServiceClient();
  const { data: open, error: readErr } = await sb
    .from("seo_issues")
    .select("id, fingerprint")
    .eq("client_id", clientId)
    .eq("status", "open");
  if (readErr) throw new Error(`Failed to load open issues: ${readErr.message}`);

  const toResolve = (open ?? [])
    .filter((row) => !observedFingerprints.has(row.fingerprint as string))
    .map((row) => row.id as string);

  if (toResolve.length === 0) return 0;

  const { error: updateErr } = await sb
    .from("seo_issues")
    .update({
      status: "fixed" as SeoIssueStatus,
      resolved_at: new Date().toISOString(),
      resolved_check_id: checkId,
    })
    .in("id", toResolve);
  if (updateErr) throw new Error(`Failed to resolve issues: ${updateErr.message}`);

  return toResolve.length;
}

// ============================================================
// seo_clients (lookup helpers — clients.seo_config)
// ============================================================

export interface SeoClientRow {
  id: string;
  workspace_id: string;
  name: string;
  seo_config: import("./types").SeoConfig | null;
}

export async function listEnabledSeoClients(): Promise<SeoClientRow[]> {
  const { data, error } = await getServiceClient()
    .from("clients")
    .select("id, workspace_id, name, seo_config")
    .not("seo_config", "is", null);
  if (error) throw new Error(`Failed to list seo clients: ${error.message}`);
  return ((data ?? []) as SeoClientRow[]).filter(
    (c) => c.seo_config?.enabled === true
  );
}

export async function getSeoClient(clientId: string): Promise<SeoClientRow | null> {
  const { data } = await getServiceClient()
    .from("clients")
    .select("id, workspace_id, name, seo_config")
    .eq("id", clientId)
    .maybeSingle();
  return (data as SeoClientRow) ?? null;
}

