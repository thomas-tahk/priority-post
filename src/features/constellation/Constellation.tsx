"use client";

import { useEffect, useRef, useState } from "react";
import type { Task } from "@/db/schema";
import { CATEGORIES, CATEGORY_LABELS } from "@/features/tasks/categories";
import { lobePositions, packLayout, type ScoredTask } from "./layout";

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
      // Reserve a bit of vertical room for the legend strip.
      const legendH = 50;
      setSize({ w: Math.max(200, width), h: Math.max(200, height - legendH) });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const items = size ? packLayout(scored, size.w, size.h) : [];

  return (
    <div className="constellation-pane" ref={containerRef}>
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
            {items.map((it) => {
              const label =
                it.task.title.length > 14
                  ? it.task.title.slice(0, 13) + "…"
                  : it.task.title;
              const fontSize = Math.max(10, Math.min(14, it.r * 0.18));

              const shapes =
                it.cats.length === 1 ? (
                  <circle
                    cx={it.x}
                    cy={it.y}
                    r={it.r}
                    fill={`var(--cat-${it.cats[0]})`}
                  />
                ) : (
                  lobePositions(it).map((lobe, i) => (
                    <circle
                      key={i}
                      cx={lobe.x}
                      cy={lobe.y}
                      r={lobe.r}
                      fill={`var(--cat-${lobe.cat})`}
                      opacity={0.88}
                    />
                  ))
                );

              return (
                <g
                  key={it.task.id}
                  className={`bubble ${it.isTop ? "top" : ""}`}
                  onClick={() => onSelect?.(it.task)}
                  style={{ cursor: "pointer" }}
                >
                  {it.isTop && (
                    <circle
                      className="top-ring"
                      cx={it.x}
                      cy={it.y}
                      r={it.visualR + 5}
                      fill="none"
                      stroke="var(--accent)"
                      strokeWidth={3.5}
                    />
                  )}
                  {shapes}
                  {it.r > 26 && (
                    <text
                      x={it.x}
                      y={it.y + 3}
                      fontSize={fontSize}
                      fill="white"
                      fontWeight={600}
                      textAnchor="middle"
                      style={{
                        pointerEvents: "none",
                        textShadow: "0 1px 3px rgba(0,0,0,0.4)",
                      }}
                    >
                      {label}
                    </text>
                  )}
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
