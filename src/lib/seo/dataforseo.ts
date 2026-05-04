// Minimal DataForSEO client. Calls the Live API endpoints we actually need
// for keyword rank tracking + competitor analysis. No SDK — just fetch + base64.
//
// Auth: HTTP Basic with login = email, password = the API key Justin gets
// from the DataForSEO dashboard.
//
// Env required to activate: DATAFORSEO_LOGIN, DATAFORSEO_PASSWORD.
// When unset, throws DataForSeoNotConfiguredError so the executor can mark
// the job as cleanly failed without silent partial results.

const API_BASE = "https://api.dataforseo.com";

export class DataForSeoNotConfiguredError extends Error {
  constructor() {
    super("DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD env vars are not set");
    this.name = "DataForSeoNotConfiguredError";
  }
}

export function isDataForSeoConfigured(): boolean {
  return !!(process.env.DATAFORSEO_LOGIN && process.env.DATAFORSEO_PASSWORD);
}

function authHeader(): string {
  const login = process.env.DATAFORSEO_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD;
  if (!login || !password) throw new DataForSeoNotConfiguredError();
  const token = Buffer.from(`${login}:${password}`).toString("base64");
  return `Basic ${token}`;
}

interface DfsResponse<T> {
  status_code: number;
  status_message?: string;
  tasks: Array<{
    status_code: number;
    status_message?: string;
    result?: T[] | null;
  }>;
}

async function post<TReq, TRes>(
  path: string,
  body: TReq[]
): Promise<DfsResponse<TRes>> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader(),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`DataForSEO ${res.status}: ${text.slice(0, 300)}`);
  }
  const json = (await res.json()) as DfsResponse<TRes>;
  if (json.status_code >= 40000) {
    throw new Error(
      `DataForSEO API error ${json.status_code}: ${json.status_message ?? "unknown"}`
    );
  }
  return json;
}

// ============================================================
// SERP — Google organic, live (advanced)
// Returns up to 100 organic results for the query/location/language.
// ============================================================

export interface SerpItem {
  type: string;
  rank_group?: number;
  rank_absolute?: number;
  domain?: string;
  url?: string;
  title?: string;
  description?: string;
}

export interface SerpResult {
  keyword: string;
  items: SerpItem[];
}

export async function fetchSerp(opts: {
  keyword: string;
  location_code?: number; // default 2840 (US)
  language_code?: string; // default 'en'
  device?: "desktop" | "mobile";
  depth?: number; // results to return (max ~100)
}): Promise<SerpResult> {
  const json = await post<
    Record<string, unknown>,
    { items?: SerpItem[]; keyword?: string }
  >("/v3/serp/google/organic/live/advanced", [
    {
      keyword: opts.keyword,
      location_code: opts.location_code ?? 2840,
      language_code: opts.language_code ?? "en",
      device: opts.device ?? "desktop",
      depth: opts.depth ?? 50,
    },
  ]);
  const result = json.tasks[0]?.result?.[0];
  return {
    keyword: opts.keyword,
    items: (result?.items ?? []) as SerpItem[],
  };
}

// Find rank for a domain inside a SerpResult. Returns null if not in top N.
export function findDomainRank(
  serp: SerpResult,
  domain: string
): { rank: number; url: string | null } | null {
  const norm = domain.toLowerCase().replace(/^www\./, "");
  for (const item of serp.items) {
    if (!item.domain) continue;
    const itemDomain = item.domain.toLowerCase().replace(/^www\./, "");
    if (itemDomain === norm || itemDomain.endsWith(`.${norm}`)) {
      return {
        rank: item.rank_absolute ?? item.rank_group ?? 0,
        url: item.url ?? null,
      };
    }
  }
  return null;
}

// ============================================================
// Ranked keywords — what a domain currently ranks for, organic
// Used for competitor gap analysis.
// ============================================================

export interface RankedKeyword {
  keyword: string;
  search_volume: number | null;
  cpc: number | null;
  rank_absolute: number;
  url: string | null;
}

export async function fetchRankedKeywords(opts: {
  domain: string;
  location_code?: number;
  language_code?: string;
  limit?: number; // default 100
}): Promise<RankedKeyword[]> {
  interface Item {
    keyword_data?: {
      keyword?: string;
      keyword_info?: { search_volume?: number; cpc?: number };
    };
    ranked_serp_element?: {
      serp_item?: { rank_absolute?: number; url?: string };
    };
  }
  const json = await post<Record<string, unknown>, { items?: Item[] }>(
    "/v3/dataforseo_labs/google/ranked_keywords/live",
    [
      {
        target: opts.domain,
        location_code: opts.location_code ?? 2840,
        language_code: opts.language_code ?? "en",
        limit: opts.limit ?? 100,
        ignore_synonyms: true,
        order_by: ["ranked_serp_element.serp_item.rank_absolute,asc"],
      },
    ]
  );
  const items = json.tasks[0]?.result?.[0]?.items ?? [];
  return items.map((it) => ({
    keyword: it.keyword_data?.keyword ?? "",
    search_volume: it.keyword_data?.keyword_info?.search_volume ?? null,
    cpc: it.keyword_data?.keyword_info?.cpc ?? null,
    rank_absolute: it.ranked_serp_element?.serp_item?.rank_absolute ?? 0,
    url: it.ranked_serp_element?.serp_item?.url ?? null,
  }));
}
