// Per-client SEO configuration stored in clients.seo_config (JSONB).
// Validated in TypeScript only — DB stores as raw jsonb so we can evolve
// the shape without migrations.
export interface SeoConfig {
  enabled: boolean;
  domain: string;                    // e.g., "niewdel.com"
  contact_email?: string;            // where the monthly PDF is delivered (primary To)
  report_cc?: string[];              // extra client-side recipients, CC'd on the report
  contact_name?: string;
  target_keywords?: string[];        // for paid keyword check
  competitor_domains?: string[];     // for paid competitor check
  crawl_config?: {
    max_pages?: number;              // default 25
    include_paths?: string[];        // glob-ish prefixes
    exclude_paths?: string[];
  };
  dry_run?: boolean;                 // first 2 weeks per client; suppresses task creation + sends
  report_status?: "enabled" | "paused";
  paid_tracking_enabled?: boolean;   // gates paid_keyword + paid_competitor crons

  // Google Analytics 4 — set per-client. Pipeline pulls a traffic snapshot
  // each weekly_check when this is set AND the user has a connected
  // google_oauth_connections row.
  ga4_property_id?: string;

  // Google Ads — per-client sub-account. Operator-level dev token + MCC login
  // ID come from env; this just names which linked account to read.
  google_ads?: {
    customer_id?: string;            // 10-digit, no hyphens
    enabled?: boolean;
  };

  // Maps this client's GA4 event names to lead types so the Leads panel can
  // count booking / contact / call / email actions and attribute them by
  // channel. Event names vary per site (e.g. an Urable booking widget fires
  // "urable_click"; a tap-to-call fires "phone_tap"). Each type maps to one
  // or more event names.
  lead_events?: {
    booking?: string[];
    contact?: string[];
    call?: string[];
    email?: string[];
  };
}

export type SeoJobType =
  | "weekly_check"
  | "monthly_report"
  | "paid_keyword"
  | "paid_competitor";

export type SeoJobStatus =
  | "queued"
  | "running"
  | "complete"
  | "failed"
  | "cancelled";

// Heartbeat staleness: weekly checks write progress every per-page tick
// (~1-2s during PSI calls); 3 minutes is well outside normal jitter.
export const SEO_JOB_HEARTBEAT_TIMEOUT_MS = 3 * 60 * 1000;

export const NON_TERMINAL_SEO_STATUSES: SeoJobStatus[] = ["queued", "running"];

export type SeoIssueSeverity = "critical" | "high" | "medium" | "low";
export type SeoIssueCategory =
  | "technical"
  | "performance"
  | "onpage"
  | "content"
  | "schema"
  | "gbp"
  | "ai_search";
export type SeoIssueStatus = "open" | "fixed" | "ignored";

export interface SeoIssueDraft {
  fingerprint: string;
  severity: SeoIssueSeverity;
  category: SeoIssueCategory;
  sub_type: string;          // stable issue type key, e.g. "missing_h1"
  page_url?: string | null;
  title: string;
  description?: string;
  recommendation?: string;
}

// Per-page snapshot stored in seo_checks.pages
export interface PageSnapshot {
  url: string;
  content_hash: string;
  status_code: number;
  title: string;
  meta_desc: string;
  h1_count: number;
  h2_count: number;
  alt_total: number;
  alt_missing: number;
  schema_types: string[];
  has_canonical: boolean;
  psi_mobile?: number;
  psi_desktop?: number;
  word_count: number;
}

export interface CheckScores {
  technical: number;          // 0-100
  lighthouse_mobile: number | null;
  lighthouse_desktop: number | null;
  onpage: number;             // 0-100
  freshness_days: number | null;
}
