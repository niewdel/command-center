import { ExternalLink } from "lucide-react";
import type { ReportData } from "@/lib/seo/report-types";

interface Props {
  client: ReportData["client"];
}

function domainToUrl(domain: string): string | null {
  if (!domain) return null;
  return domain.startsWith("http") ? domain : `https://${domain}`;
}

export function PortalHeader({ client }: Props) {
  const siteUrl = domainToUrl(client.domain);

  return (
    <header className="mb-10">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logos/niewdel-wordmark.png"
        alt="Niewdel"
        className="h-6 w-auto mb-8 opacity-90"
      />
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <span className="report-eyebrow block">Your Portal</span>
          <h1 className="mt-3 text-3xl md:text-4xl font-bold tracking-tight text-balance text-foreground">
            {client.name}
            <span className="text-[var(--rust)]">.</span>
          </h1>
          <span className="report-rule mt-3" />
          {siteUrl && (
            <a
              href={siteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(
                  client.domain
                )}&sz=64`}
                alt=""
                className="size-4 rounded-sm"
              />
              {client.domain}
              <ExternalLink className="size-3 opacity-60" aria-hidden="true" />
            </a>
          )}
        </div>
        <div className="text-right text-muted-foreground text-xs">
          {client.period_label}
        </div>
      </div>
    </header>
  );
}
