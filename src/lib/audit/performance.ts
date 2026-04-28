import { PSIMetrics, PSIAuditItem } from './types';

const PSI_ENDPOINT = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';
const MAX_CONCURRENT = 3;
const REQUEST_TIMEOUT_MS = 240_000;
const MAX_RETRIES = 1;

interface PSIResponse {
  lighthouseResult: {
    categories: {
      performance?: { score: number };
      accessibility?: { score: number };
      seo?: { score: number };
      'best-practices'?: { score: number };
    };
    audits: Record<
      string,
      {
        id: string;
        title: string;
        score: number | null;
        displayValue?: string;
        description: string;
        numericValue?: number;
      }
    >;
  };
}

function buildUrl(targetUrl: string): string {
  const params = new URLSearchParams();
  params.set('url', targetUrl);
  params.set('strategy', 'mobile');
  params.append('category', 'performance');
  params.append('category', 'accessibility');
  params.append('category', 'seo');
  params.append('category', 'best-practices');

  const apiKey = process.env.GOOGLE_PSI_API_KEY;
  if (apiKey) {
    params.set('key', apiKey);
  }

  return `${PSI_ENDPOINT}?${params.toString()}`;
}

function extractMetrics(url: string, data: PSIResponse): PSIMetrics {
  const { categories, audits } = data.lighthouseResult;

  const scores = {
    performance: Math.round((categories.performance?.score ?? 0) * 100),
    accessibility: Math.round((categories.accessibility?.score ?? 0) * 100),
    seo: Math.round((categories.seo?.score ?? 0) * 100),
    bestPractices: Math.round((categories['best-practices']?.score ?? 0) * 100),
  };

  const coreWebVitals = {
    lcp: audits['largest-contentful-paint']?.numericValue ?? 0,
    tbt: audits['total-blocking-time']?.numericValue ?? 0,
    cls: audits['cumulative-layout-shift']?.numericValue ?? 0,
    fcp: audits['first-contentful-paint']?.numericValue ?? 0,
    speedIndex: audits['speed-index']?.numericValue ?? 0,
    ttfb: audits['server-response-time']?.numericValue ?? 0,
  };

  const auditItems: PSIAuditItem[] = Object.values(audits).map((audit) => ({
    id: audit.id,
    title: audit.title,
    score: audit.score,
    displayValue: audit.displayValue,
    description: audit.description,
  }));

  return { url, scores, coreWebVitals, audits: auditItems };
}

async function fetchPSISingle(
  url: string,
  onProgress?: (message: string) => void
): Promise<PSIMetrics | null> {
  const requestUrl = buildUrl(url);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(requestUrl, { signal: controller.signal });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      onProgress?.(`PSI request failed for ${url}: HTTP ${response.status} — ${errorBody.slice(0, 200)}`);
      return null;
    }

    const data = (await response.json()) as PSIResponse;

    if (!data.lighthouseResult?.audits || !data.lighthouseResult?.categories) {
      onProgress?.(`PSI returned incomplete data for ${url}, skipping.`);
      return null;
    }

    const metrics = extractMetrics(url, data);
    onProgress?.(`Performance analysis complete for ${url} (score: ${metrics.scores.performance})`);
    return metrics;
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      onProgress?.(`PSI request timed out for ${url} after ${REQUEST_TIMEOUT_MS / 1000}s.`);
    } else {
      const message = error instanceof Error ? error.message : String(error);
      onProgress?.(`PSI request failed for ${url}: ${message}`);
    }
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchPSI(
  url: string,
  onProgress?: (message: string) => void
): Promise<PSIMetrics | null> {
  onProgress?.(`Analyzing performance for ${url}...`);

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      onProgress?.(`Retrying PSI for ${url} (attempt ${attempt + 1})...`);
    }
    const result = await fetchPSISingle(url, onProgress);
    if (result) return result;

    // Don't retry on last attempt
    if (attempt < MAX_RETRIES) {
      // Brief pause before retry
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  onProgress?.(`PSI failed for ${url} after ${MAX_RETRIES + 1} attempts, skipping.`);
  return null;
}

/**
 * Runs a pool of async tasks with a concurrency limit.
 * Returns results in the same order as the input tasks.
 */
async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < tasks.length) {
      const index = nextIndex++;
      results[index] = await tasks[index]();
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, tasks.length) },
    () => worker()
  );

  await Promise.all(workers);
  return results;
}

/**
 * Runs PageSpeed Insights audits against the provided URLs (mobile strategy).
 * Skips any URL that fails or times out. Runs up to 3 concurrent requests.
 */
export async function runPerformanceAudit(
  urls: string[],
  onProgress?: (message: string) => void
): Promise<PSIMetrics[]> {
  if (urls.length === 0) {
    onProgress?.('No URLs provided for performance audit.');
    return [];
  }

  onProgress?.(`Starting performance audit for ${urls.length} URL${urls.length === 1 ? '' : 's'}...`);

  const tasks = urls.map((url) => () => fetchPSI(url, onProgress));
  const results = await runWithConcurrency(tasks, MAX_CONCURRENT);

  const successful = results.filter((r): r is PSIMetrics => r !== null);

  onProgress?.(
    `Performance audit complete: ${successful.length}/${urls.length} URL${urls.length === 1 ? '' : 's'} analyzed.`
  );

  return successful;
}
