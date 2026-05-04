import { createHash } from "node:crypto";

// Stable issue identity across weekly runs. Same category + page + sub_type
// always produces the same fingerprint, so the unique partial index on
// seo_issues(client_id, fingerprint) where status='open' makes diffing
// idempotent — no duplicate "missing H1" rows for the same page each week.
export function issueFingerprint(
  category: string,
  sub_type: string,
  page_url: string | null | undefined
): string {
  const normalized = [category, sub_type, page_url ?? ""].join("|");
  return createHash("sha256").update(normalized).digest("hex").slice(0, 32);
}

// Per-page content hash. Used in PageSnapshot.content_hash so diff logic can
// detect "this page didn't change at all" without comparing every field.
// Hash is over the visible text + title + meta + headings; ignores formatting.
export function pageContentHash(
  title: string,
  meta_desc: string,
  body_text: string,
  headings: { level: number; text: string }[]
): string {
  const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();
  const headingsStr = headings.map((h) => `${h.level}:${norm(h.text)}`).join("\n");
  const payload = [
    `t:${norm(title)}`,
    `m:${norm(meta_desc)}`,
    `h:${headingsStr}`,
    `b:${norm(body_text).slice(0, 8000)}`, // body cap so a giant blog post doesn't dominate
  ].join("\n---\n");
  return createHash("sha256").update(payload).digest("hex").slice(0, 32);
}
