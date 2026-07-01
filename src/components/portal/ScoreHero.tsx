// src/components/portal/ScoreHero.tsx
//
// Client-facing "how you're doing" hero. Reuses the navy hero block
// pattern from the operator report's HealthSection but with friendlier
// copy (no "Overall Score" jargon, an outcome-first status line) since
// this is the first thing a client sees.

import type { ReportData } from "@/lib/seo/report-types";

function scoreLabel(score: number | null): string {
  if (score == null) return "Getting started";
  if (score >= 76) return "Strong";
  if (score >= 51) return "On track";
  return "Building";
}

function scoreCopy(score: number | null): string {
  if (score == null) {
    return "We're building your first visibility snapshot.";
  }
  if (score >= 76) {
    return "Your site is performing well across the board.";
  }
  if (score >= 51) {
    return "Steady progress. Here's where things stand.";
  }
  return "Early days. Here's what we're working on.";
}

export function ScoreHero({ data }: { data: ReportData }) {
  const { overall_score, overall_delta } = data.health;
  const label = scoreLabel(overall_score);
  const showDelta = overall_delta != null && overall_delta !== 0;

  return (
    <section className="rounded-[14px] bg-[var(--rust-deep)] p-7 md:p-9">
      <div className="report-eyebrow mb-4" style={{ color: "#9DBEE8" }}>
        How you&apos;re doing
      </div>
      <div className="flex items-baseline gap-4 flex-wrap">
        <div className="text-6xl md:text-7xl font-bold text-white font-data tracking-tight tabular-nums">
          {overall_score ?? "—"}
          {overall_score != null && (
            <span className="text-[#9DBEE8] text-2xl md:text-3xl font-medium ml-2 opacity-80">
              /100
            </span>
          )}
        </div>
        <div className="space-y-1">
          <div className="text-sm font-semibold uppercase tracking-[0.12em] text-white">
            {label}
          </div>
          {showDelta && (
            <div
              className={`text-sm ${
                overall_delta! > 0 ? "text-[#C7E0C9]" : "text-[#E8C7C7]"
              }`}
            >
              {overall_delta! > 0 ? "↑" : "↓"} {Math.abs(overall_delta!)} since
              the start of this period
            </div>
          )}
        </div>
      </div>
      <p className="mt-4 text-sm text-[#C9D8EC] max-w-[60ch] text-pretty">
        {scoreCopy(overall_score)}
      </p>
    </section>
  );
}
