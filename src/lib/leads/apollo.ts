const BASE_URL = "https://api.apollo.io/v1";

interface ApolloOrg {
  id: string;
  name: string;
  website_url: string | null;
  primary_domain: string | null;
  industry: string | null;
  estimated_num_employees: number | null;
  organization_revenue_printed: string | null;
  organization_revenue: number | null;
  city: string | null;
  state: string | null;
  country: string | null;
  keywords: string[];
  linkedin_url: string | null;
  founded_year: number | null;
  latest_funding_stage: string | null;
  short_description: string | null;
  technology_names: string[] | null;
}

interface ApolloOrgSearchResponse {
  organizations: ApolloOrg[];
  pagination: {
    page: number;
    per_page: number;
    total_entries: number;
    total_pages: number;
  };
}

async function apolloRequest<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) throw new Error("Missing APOLLO_API_KEY");

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Apollo API ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export async function searchOrganizations(
  params: {
    organization_revenue_ranges?: string[];
    organization_num_employees_ranges?: string[];
    organization_locations?: string[];
    q_organization_keyword_tags?: string[];
  },
  page = 1,
  perPage = 100
): Promise<ApolloOrgSearchResponse> {
  return apolloRequest<ApolloOrgSearchResponse>("/organizations/search", {
    page,
    per_page: perPage,
    ...params,
  });
}

export async function searchAllOrgs(
  params: Parameters<typeof searchOrganizations>[0],
  maxResults = 500
): Promise<ApolloOrg[]> {
  const perPage = 100;
  const maxPages = Math.ceil(maxResults / perPage);
  const all: ApolloOrg[] = [];

  for (let page = 1; page <= maxPages; page++) {
    const res = await searchOrganizations(params, page, perPage);
    if (!res.organizations?.length) break;
    all.push(...res.organizations);
    if (page >= res.pagination.total_pages) break;
    if (all.length >= maxResults) break;
    await sleep(650);
  }
  return all.slice(0, maxResults);
}

export function mapApolloOrg(org: ApolloOrg) {
  // Apollo returns tech stack under two different keys depending on plan:
  // `technology_names` (Pro+) and `keywords` (everyone). Prefer the explicit
  // tech list; fall back to keywords filtered to look "tech-ish."
  const tech = (org.technology_names ?? []).filter(Boolean);
  const technologies = tech.length
    ? tech
    : (org.keywords ?? []).filter((k) => k && k.length < 40);

  return {
    name: org.name ?? "Unknown",
    domain: org.primary_domain ?? null,
    website: org.website_url ?? null,
    industry: org.industry ?? null,
    revenue_range: org.organization_revenue_printed ?? null,
    headcount: org.estimated_num_employees ?? null,
    city: org.city ?? null,
    state: org.state ?? null,
    country: org.country ?? "US",
    founded_year: org.founded_year ?? null,
    latest_funding_stage: org.latest_funding_stage ?? null,
    short_description: org.short_description ?? null,
    linkedin_url: org.linkedin_url ?? null,
    technologies,
    source: "apollo" as const,
    source_id: org.id ?? null,
  };
}

export type { ApolloOrg };

/**
 * Person enrichment — Apollo /people/match. Gated behind an explicit button
 * on each prospect card so we don't burn credits during the auto pipeline.
 * Returns the first phone number Apollo has for the match, or null.
 */
export async function matchPerson(args: {
  domain: string;
  first_name: string | null;
  last_name: string | null;
  email?: string | null;
}): Promise<{ phone: string | null; raw: Record<string, unknown> | null }> {
  const body: Record<string, unknown> = {
    domain: args.domain,
    reveal_personal_emails: false,
    reveal_phone_number: true,
  };
  if (args.first_name) body.first_name = args.first_name;
  if (args.last_name) body.last_name = args.last_name;
  if (args.email) body.email = args.email;

  type MatchResponse = {
    person: {
      phone_numbers?: Array<{ raw_number?: string | null; sanitized_number?: string | null }>;
      mobile_phone?: string | null;
      organization?: { phone?: string | null } | null;
    } | null;
  };

  const res = await apolloRequest<MatchResponse>("/people/match", body);
  const person = res.person ?? null;
  if (!person) return { phone: null, raw: null };
  const phones = person.phone_numbers ?? [];
  const first =
    person.mobile_phone ??
    phones[0]?.sanitized_number ??
    phones[0]?.raw_number ??
    person.organization?.phone ??
    null;
  return { phone: first, raw: person as unknown as Record<string, unknown> };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
