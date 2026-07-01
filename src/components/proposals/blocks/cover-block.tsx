import type { CoverBlock } from "@/types/proposals";

export function CoverBlockView({ block }: { block: CoverBlock }) {
  return (
    <header className="mb-14">
      <span className="report-eyebrow block">{block.kicker}</span>
      <h1 className="mt-3 text-3xl md:text-4xl font-bold text-balance text-foreground font-heading">
        {block.headline}
      </h1>
      <span className="report-rule mt-3" />
      <p className="mt-4 max-w-2xl text-pretty text-muted-foreground">{block.intro}</p>
      <dl className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <dt className="report-label">Prepared for</dt>
          <dd className="mt-1 text-sm text-foreground">{block.preparedFor}</dd>
        </div>
        <div>
          <dt className="report-label">Prepared by</dt>
          <dd className="mt-1 text-sm text-foreground">{block.preparedBy}</dd>
        </div>
        <div>
          <dt className="report-label">Valid through</dt>
          <dd className="mt-1 text-sm text-foreground">{block.validityDate}</dd>
        </div>
      </dl>
    </header>
  );
}
