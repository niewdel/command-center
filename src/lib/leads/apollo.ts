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
    source: "apollo" as const,
    source_id: org.id ?? null,
  };
}

export type { ApolloOrg };

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
