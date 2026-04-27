const BASE_URL = "https://api.hunter.io/v2";

interface HunterEmail {
  value: string;
  type: string;
  confidence: number;
  first_name: string | null;
  last_name: string | null;
  position: string | null;
  seniority: string | null;
  department: string | null;
  linkedin: string | null;
  twitter: string | null;
  phone_number: string | null;
  verification: { date: string | null; status: string };
}

interface HunterDomainResponse {
  data: {
    domain: string;
    organization: string;
    pattern: string | null;
    emails: HunterEmail[];
  };
}

interface HunterAccountResponse {
  data: {
    requests: {
      searches: { used: number; available: number };
    };
  };
}

async function hunterGet<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const apiKey = process.env.HUNTER_API_KEY;
  if (!apiKey) throw new Error("Missing HUNTER_API_KEY");

  const url = new URL(`${BASE_URL}${endpoint}`);
  url.searchParams.set("api_key", apiKey);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url.toString());
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Hunter API ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export async function domainSearch(
  domain: string,
  opts: { limit?: number; seniority?: string[]; department?: string[] } = {}
): Promise<{ organization: string; emails: HunterEmail[]; pattern: string | null }> {
  const params: Record<string, string> = {
    domain,
    limit: String(opts.limit ?? 10),
  };
  if (opts.seniority?.length) params.seniority = opts.seniority.join(",");
  if (opts.department?.length) params.department = opts.department.join(",");

  const res = await hunterGet<HunterDomainResponse>("/domain-search", params);
  return {
    organization: res.data.organization,
    emails: res.data.emails,
    pattern: res.data.pattern,
  };
}

export async function getAccountUsage(): Promise<{ searches: { used: number; available: number } }> {
  const res = await hunterGet<HunterAccountResponse>("/account");
  return { searches: res.data.requests.searches };
}

export function mapHunterContact(email: HunterEmail) {
  const fullName = [email.first_name, email.last_name].filter(Boolean).join(" ");
  return {
    full_name: fullName || email.value.split("@")[0],
    first_name: email.first_name ?? null,
    last_name: email.last_name ?? null,
    title: email.position ?? null,
    email: email.value,
    email_verified: email.verification?.status === "valid",
    linkedin_url: email.linkedin ?? null,
    source: "hunter" as const,
    source_id: null as string | null,
    confidence: email.confidence,
    seniority: email.seniority,
    department: email.department,
  };
}

export type { HunterEmail };
