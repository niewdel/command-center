"use client";

import { useState } from "react";
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
  color: string;
}

// Brand ramp — blue leads, then green / amber / light-blue. Distinct but
// on-palette (no teal or purple), matching the report's signal colors.
const SERIES: SeriesDef[] = [
  { key: "technical_score", label: "Technical", color: "#3B86DB" },
  { key: "onpage_score", label: "On-page", color: "#35B37E" },
  { key: "lighthouse_mobile", label: "Mobile", color: "#D9A441" },
  { key: "lighthouse_desktop", label: "Desktop", color: "#5A9BE6" },
];

const W = 860;
const H = 280;
const PAD_L = 38;
const PAD_R = 64; // room for end-of-line value labels
const PAD_T = 18;
const PAD_B = 30;

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function ScoreHistoryChart({ points }: { points: ScoreHistoryPoint[] }) {
  const chrono = points; // oldest → newest
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (chrono.length < 2) {
    return (
      <Card className="p-5 text-xs text-muted-foreground">
        Score history will appear after the second check.
      </Card>
    );
  }

  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;

  // Auto-zoom the Y axis to the data so changes are visible instead of all
  // lines crammed into the top of a fixed 0–100 scale. Round out to a tidy
  // 10-step band with a little headroom, clamped to [0, 100].
  const allVals = chrono.flatMap((p) =>
    SERIES.map((s) => p[s.key]).filter((v): v is number => v != null)
  );
  const dataMin = allVals.length ? Math.min(...allVals) : 0;
  const dataMax = allVals.length ? Math.max(...allVals) : 100;
  let yMin = Math.max(0, Math.floor((dataMin - 4) / 10) * 10);
  const yMax = Math.min(100, Math.ceil((dataMax + 2) / 10) * 10);
  if (yMax - yMin < 20) yMin = Math.max(0, yMax - 20); // keep a readable band

  const xFor = (i: number): number =>
    PAD_L + (i / Math.max(1, chrono.length - 1)) * innerW;
  const yFor = (v: number): number =>
    PAD_T + innerH - ((Math.max(yMin, Math.min(yMax, v)) - yMin) / (yMax - yMin)) * innerH;

  // SVG path per series, breaking the line at null gaps.
  const paths = SERIES.map((s) => {
    const segs: string[] = [];
    let pen = false;
    chrono.forEach((p, i) => {
      const v = p[s.key];
      if (v == null) { pen = false; return; }
      segs.push(`${pen ? "L" : "M"}${xFor(i).toFixed(1)},${yFor(v).toFixed(1)}`);
      pen = true;
    });
    const last = [...chrono].reverse().find((p) => p[s.key] != null);
    return { ...s, d: segs.join(" "), lastValue: last ? last[s.key] : null };
  });

  // Three gridlines: bottom, middle, top of the zoomed band.
  const mid = Math.round((yMin + yMax) / 2);
  const grid = [yMin, mid, yMax];

  // End-of-line value labels, de-overlapped vertically.
  const endLabels = paths
    .filter((p) => p.lastValue != null)
    .map((p) => ({ key: p.key, color: p.color, value: p.lastValue as number, y: yFor(p.lastValue as number) }))
    .sort((a, b) => a.y - b.y);
  const MIN_GAP = 15;
  for (let i = 1; i < endLabels.length; i++) {
    if (endLabels[i].y - endLabels[i - 1].y < MIN_GAP) {
      endLabels[i].y = endLabels[i - 1].y + MIN_GAP;
    }
  }

  const hovered = hoverIdx != null ? chrono[hoverIdx] : null;

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Score history
          </div>
          <div className="text-sm text-foreground mt-0.5">
            {chrono.length} checks · {fmtDate(chrono[0].created_at)} &rarr;{" "}
            {fmtDate(chrono[chrono.length - 1].created_at)}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 justify-end">
          {SERIES.map((s) => (
            <span key={s.key} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="size-2.5 rounded-full" style={{ backgroundColor: s.color }} />
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
            const i = Math.round(((x - PAD_L) / innerW) * (chrono.length - 1));
            setHoverIdx(i >= 0 && i < chrono.length ? i : null);
          }}
        >
          {/* Gridlines + Y labels */}
          {grid.map((g) => (
            <g key={g}>
              <line
                x1={PAD_L}
                x2={W - PAD_R}
                y1={yFor(g)}
                y2={yFor(g)}
                className="stroke-border"
                strokeWidth={1}
                strokeDasharray={g === yMin ? "0" : "3 5"}
                opacity={g === yMin ? 0.7 : 0.3}
              />
              <text
                x={PAD_L - 8}
                y={yFor(g) + 3}
                textAnchor="end"
                className="fill-muted-foreground"
                style={{ fontSize: 10 }}
              >
                {g}
              </text>
            </g>
          ))}

          {/* Series lines */}
          {paths.map((p) => (
            <path
              key={p.key}
              d={p.d}
              fill="none"
              stroke={p.color}
              strokeWidth={2.25}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}

          {/* Endpoint dots */}
          {paths.map((p) =>
            p.lastValue == null ? null : (
              <circle
                key={p.key}
                cx={xFor(chrono.length - 1)}
                cy={yFor(p.lastValue)}
                r={3.5}
                fill={p.color}
                className="stroke-card"
                strokeWidth={2}
              />
            )
          )}

          {/* End-of-line value labels */}
          {endLabels.map((l) => (
            <text
              key={l.key}
              x={xFor(chrono.length - 1) + 9}
              y={l.y + 3.5}
              className="font-semibold"
              style={{ fontSize: 12, fill: l.color }}
            >
              {l.value}
            </text>
          ))}

          {/* Hover guide + markers */}
          {hoverIdx != null && (
            <line
              x1={xFor(hoverIdx)}
              x2={xFor(hoverIdx)}
              y1={PAD_T}
              y2={H - PAD_B}
              className="stroke-foreground"
              strokeWidth={1}
              opacity={0.25}
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
                  r={3.5}
                  fill={p.color}
                  className="stroke-card"
                  strokeWidth={2}
                />
              );
            })}

          {/* X labels */}
          <text x={PAD_L} y={H - 6} className="fill-muted-foreground" style={{ fontSize: 10 }}>
            {fmtDate(chrono[0].created_at)}
          </text>
          <text
            x={W - PAD_R}
            y={H - 6}
            textAnchor="end"
            className="fill-muted-foreground"
            style={{ fontSize: 10 }}
          >
            {fmtDate(chrono[chrono.length - 1].created_at)}
          </text>
        </svg>

        {hovered && hoverIdx != null && (
          <div
            className="absolute pointer-events-none rounded-lg border border-border bg-popover px-2.5 py-2 shadow-md"
            style={{
              left: `${(xFor(hoverIdx) / W) * 100}%`,
              top: 0,
              transform:
                xFor(hoverIdx) > W / 2
                  ? "translate(calc(-100% - 10px), 0)"
                  : "translate(10px, 0)",
            }}
          >
            <div className="text-[10px] text-muted-foreground mb-1">
              {fmtDate(hovered.created_at)}
            </div>
            <div className="space-y-0.5">
              {SERIES.map((s) => (
                <div key={s.key} className="flex items-center justify-between gap-4 text-[11px]">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-1.5 rounded-full" style={{ backgroundColor: s.color }} />
                    {s.label}
                  </span>
                  <span className="tabular-nums font-medium">
                    {hovered[s.key] == null ? "—" : hovered[s.key]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
