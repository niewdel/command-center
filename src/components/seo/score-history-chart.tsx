"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";

export interface ScoreHistoryPoint {
  created_at: string;
  technical_score: number | null;
  onpage_score: number | null;
  lighthouse_mobile: number | null;
  lighthouse_desktop: number | null;
}

interface SeriesDef {
  key: keyof Omit<ScoreHistoryPoint, "created_at">;
  label: string;
  color: string; // raw hex / oklch / css var
}

const SERIES: SeriesDef[] = [
  { key: "technical_score", label: "Technical", color: "oklch(0.72 0.18 145)" },
  { key: "onpage_score", label: "On-page", color: "oklch(0.78 0.18 70)" },
  { key: "lighthouse_mobile", label: "Mobile", color: "oklch(0.74 0.20 245)" },
  { key: "lighthouse_desktop", label: "Desktop", color: "oklch(0.74 0.18 305)" },
];

const W = 800;
const H = 200;
const PADDING_X = 32;
const PADDING_Y = 20;

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function ScoreHistoryChart({
  points,
}: {
  points: ScoreHistoryPoint[];
}) {
  // Reverse: API gives newest-first; chart needs oldest-first.
  const chrono = useMemo(() => [...points].reverse(), [points]);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (chrono.length < 2) {
    return (
      <Card className="p-4 text-xs text-muted-foreground">
        Score history will appear after the second weekly check.
      </Card>
    );
  }

  const innerW = W - PADDING_X * 2;
  const innerH = H - PADDING_Y * 2;

  const xFor = (i: number): number =>
    PADDING_X + (i / Math.max(1, chrono.length - 1)) * innerW;
  const yFor = (v: number): number =>
    PADDING_Y + innerH - (Math.max(0, Math.min(100, v)) / 100) * innerH;

  // Build SVG path strings per series, skipping null gaps with M.
  const paths = SERIES.map((s) => {
    const segments: string[] = [];
    let inSegment = false;
    chrono.forEach((p, i) => {
      const v = p[s.key];
      if (v == null) {
        inSegment = false;
        return;
      }
      const cmd = inSegment ? "L" : "M";
      segments.push(`${cmd}${xFor(i).toFixed(1)},${yFor(v).toFixed(1)}`);
      inSegment = true;
    });
    return { ...s, d: segments.join(" ") };
  });

  // Y-axis grid lines at 0, 50, 100.
  const grid = [0, 50, 100];

  const hovered = hoverIdx != null ? chrono[hoverIdx] : null;

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Score history
          </div>
          <div className="text-xs text-muted-foreground">
            {chrono.length} checks · {fmtDate(chrono[0].created_at)} →{" "}
            {fmtDate(chrono[chrono.length - 1].created_at)}
          </div>
        </div>
        <div className="flex items-center gap-3 text-[10px]">
          {SERIES.map((s) => (
            <span
              key={s.key}
              className="inline-flex items-center gap-1.5 text-muted-foreground"
            >
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: s.color }}
              />
              {s.label}
            </span>
          ))}
        </div>
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto"
          role="img"
          aria-label="SEO score history"
          onMouseLeave={() => setHoverIdx(null)}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * W;
            const i = Math.round(
              ((x - PADDING_X) / innerW) * (chrono.length - 1)
            );
            if (i >= 0 && i < chrono.length) setHoverIdx(i);
            else setHoverIdx(null);
          }}
        >
          {/* Y grid */}
          {grid.map((g) => (
            <g key={g}>
              <line
                x1={PADDING_X}
                x2={W - PADDING_X}
                y1={yFor(g)}
                y2={yFor(g)}
                className="stroke-border"
                strokeWidth={1}
                strokeDasharray={g === 0 ? "0" : "2 4"}
                opacity={g === 0 ? 0.6 : 0.35}
              />
              <text
                x={PADDING_X - 6}
                y={yFor(g) + 3}
                textAnchor="end"
                className="fill-muted-foreground font-mono"
                style={{ fontSize: 9 }}
              >
                {g}
              </text>
            </g>
          ))}

          {/* Series */}
          {paths.map((p) => (
            <path
              key={p.key}
              d={p.d}
              fill="none"
              stroke={p.color}
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}

          {/* Hover indicator */}
          {hoverIdx != null && (
            <line
              x1={xFor(hoverIdx)}
              x2={xFor(hoverIdx)}
              y1={PADDING_Y}
              y2={H - PADDING_Y}
              className="stroke-foreground"
              strokeWidth={1}
              opacity={0.3}
            />
          )}
          {hoverIdx != null &&
            paths.map((p) => {
              const v = chrono[hoverIdx][p.key];
              if (v == null) return null;
              return (
                <circle
                  key={p.key}
                  cx={xFor(hoverIdx)}
                  cy={yFor(v)}
                  r={3}
                  fill={p.color}
                  className="stroke-background"
                  strokeWidth={1.5}
                />
              );
            })}

          {/* X labels — first / last */}
          <text
            x={PADDING_X}
            y={H - 4}
            className="fill-muted-foreground font-mono"
            style={{ fontSize: 9 }}
          >
            {fmtDate(chrono[0].created_at)}
          </text>
          <text
            x={W - PADDING_X}
            y={H - 4}
            textAnchor="end"
            className="fill-muted-foreground font-mono"
            style={{ fontSize: 9 }}
          >
            {fmtDate(chrono[chrono.length - 1].created_at)}
          </text>
        </svg>

        {hovered && hoverIdx != null && (
          <div
            className="absolute pointer-events-none rounded border border-border bg-popover px-2 py-1.5 shadow-sm"
            style={{
              left: `${(xFor(hoverIdx) / W) * 100}%`,
              top: 0,
              transform:
                xFor(hoverIdx) > W / 2
                  ? "translate(calc(-100% - 8px), 0)"
                  : "translate(8px, 0)",
            }}
          >
            <div className="text-[10px] text-muted-foreground mb-1">
              {fmtDate(hovered.created_at)}
            </div>
            <div className="space-y-0.5">
              {SERIES.map((s) => {
                const v = hovered[s.key];
                return (
                  <div
                    key={s.key}
                    className="flex items-center justify-between gap-3 text-[11px]"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="size-1.5 rounded-full"
                        style={{ backgroundColor: s.color }}
                      />
                      {s.label}
                    </span>
                    <span className="font-mono tabular-nums">
                      {v == null ? "—" : v}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
