"use client";

import { useEffect, useRef, useState } from "react";
import type { Task } from "@/db/schema";
import { CATEGORIES, CATEGORY_LABELS } from "@/features/tasks/categories";
import { placeOnMap, type ScoredTask } from "./layout";

const QUADRANTS: { key: string; label: string; pos: string }[] = [
  { key: "do", label: "do now", pos: "do" },
  { key: "schedule", label: "schedule", pos: "schedule" },
  { key: "batch", label: "batch", pos: "batch" },
  { key: "drop", label: "drop", pos: "drop" },
];

export function Constellation({
  scored,
  onSelect,
}: {
  scored: ScoredTask[];
  onSelect?: (task: Task) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const e = entries[0];
      if (!e) return;
      const { width, height } = e.contentRect;
      const legendH = 50;
      setSize({ w: Math.max(220, width), h: Math.max(220, height - legendH) });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const placements = size ? placeOnMap(scored, size.w, size.h) : [];

  return (
    <div className="constellation-pane" ref={containerRef}>
      {QUADRANTS.map((q) => (
        <span key={q.key} className={`quadrant-label q-${q.pos}`}>
          {q.label}
        </span>
      ))}

      {scored.length === 0 ? (
        <div className="constellation-empty">No active tasks. Add one to start.</div>
      ) : (
        size && (
          <svg
            viewBox={`0 0 ${size.w} ${size.h}`}
            width="100%"
            height={size.h}
            preserveAspectRatio="xMidYMid meet"
          >
            {/* Faint crosshairs through the center — anchors the 2x2 structure
                so bubbles read as positions on a map, not floating dots. */}
            <line
              className="quadrant-axis"
              x1={size.w / 2}
              y1={0}
              x2={size.w / 2}
              y2={size.h}
            />
            <line
              className="quadrant-axis"
              x1={0}
              y1={size.h / 2}
              x2={size.w}
              y2={size.h / 2}
            />

            {placements.map((p) => {
              const tooltip =
                p.cats.length > 1
                  ? `${p.task.title} · ${p.cats.join(", ")}`
                  : p.task.title;

              return (
                <g
                  key={p.task.id}
                  className={`bubble ${p.isTop ? "top" : ""}`}
                  onClick={() => onSelect?.(p.task)}
                >
                  <title>{tooltip}</title>
                  {p.isTop && (
                    <circle
                      className="top-ring"
                      cx={p.x}
                      cy={p.y}
                      r={p.r + 6}
                      fill="none"
                      stroke="var(--accent)"
                      strokeWidth={3.5}
                    />
                  )}
                  <circle
                    className="bubble-fill"
                    cx={p.x}
                    cy={p.y}
                    r={p.r}
                    fill={`var(--cat-${p.primaryCat})`}
                  />
                </g>
              );
            })}
          </svg>
        )
      )}

      <div className="legend">
        {CATEGORIES.map((c) => (
          <span key={c} className="item">
            <span className="swatch" style={{ background: `var(--cat-${c})` }} />
            {CATEGORY_LABELS[c]}
          </span>
        ))}
      </div>
    </div>
  );
}
