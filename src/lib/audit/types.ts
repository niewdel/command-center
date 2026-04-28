export interface AuditRequest {
  url: string;
}

export interface CrawledPage {
  url: string;
  title: string;
  metaDescription: string;
  headings: { level: number; text: string }[];
  bodyText: string;
  links: { href: string; text: string; isInternal: boolean }[];
  headLinks: { rel: string; href: string }[];
  images: { src: string; alt: string }[];
  forms: { action: string; method: string; fieldCount: number; fields: string[] }[];
  iframes: { src: string; title: string }[];
  buttons: { text: string; type: string }[];
  ogTags: Record<string, string>;
  structuredData: unknown[];
  statusCode: number;
}

export interface PSIMetrics {
  url: string;
  scores: {
    performance: number;
    accessibility: number;
    seo: number;
    bestPractices: number;
  };
  coreWebVitals: {
    lcp: number;
    tbt: number;
    cls: number;
    fcp: number;
    speedIndex: number;
    ttfb: number;
  };
  audits: PSIAuditItem[];
}

export interface PSIAuditItem {
  id: string;
  title: string;
  score: number | null;
  displayValue?: string;
  description: string;
}

export interface ScreenshotResult {
  url: string;
  screenshot: Buffer;
  annotatedScreenshot: Buffer;
  issues: VisualIssue[];
}

export interface VisualIssue {
  type: "accessibility" | "broken-image" | "low-contrast" | "overlapping";
  description: string;
  severity: "critical" | "serious" | "moderate" | "minor";
  boundingBox?: { x: number; y: number; width: number; height: number };
}

export interface CategoryResult {
  category_id: string;
  category_name: string;
  score: number;
  severity: "critical" | "serious" | "moderate" | "acceptable" | "strong";
  headline: string;
  narrative: string;
  findings: string[];
}

export interface AuditResult {
  url: string;
  siteName: string;
  auditDate: string;
  overall_score: number;
  overall_severity: "critical" | "serious" | "moderate" | "acceptable" | "strong";
  overall_headline: string;
  overall_narrative: string;
  categories: CategoryResult[];
  psiMetrics: PSIMetrics[];
  screenshots: { url: string; dataUri: string }[];
  pagesCrawled: number;
}

export interface ProgressEvent {
  type: "progress";
  progress: number;
  message: string;
}

export interface CompleteEvent {
  type: "complete";
  reportId: string;
}

export interface ErrorEvent {
  type: "error";
  message: string;
}

export type SSEEvent = ProgressEvent | CompleteEvent | ErrorEvent;
