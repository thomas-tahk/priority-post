import type { Task } from "@/db/schema";
import type { Category } from "@/features/tasks/categories";

export type LayoutItem = {
  task: Task;
  cats: Category[];
  isTop: boolean;
  r: number; // base radius (color circle for single-cat)
  visualR: number; // outermost extent for ring + packing
  x: number;
  y: number;
};

const TOP_BONUS = 1.25;
const MULTI_CAT_VISUAL_BONUS = 1.2;
const TOP_RING_PAD = 7;
const NEIGHBOR_PAD = 2;
const EDGE_INSET = 6;

export type ScoredTask = Task & { _score: number };

/**
 * Compute base radius from the deterministic score (already 0..1).
 * Pow exponent < 1 compresses the high end; we want a meaningful spread.
 */
function baseRadius(score: number): number {
  const clamped = Math.max(0, Math.min(1, score));
  return 12 + Math.pow(clamped, 1.6) * 110;
}

function makeItem(task: ScoredTask, isTop: boolean): Omit<LayoutItem, "x" | "y"> {
  const cats = task.categories as Category[];
  const r = baseRadius(task._score) * (isTop ? TOP_BONUS : 1);
  const visualR = cats.length > 1 ? r * MULTI_CAT_VISUAL_BONUS : r;
  return { task, cats, isTop, r, visualR };
}

/**
 * Deterministic spiral pack: largest first, walk outward from center,
 * find a non-overlapping spot. Pure function — same input → same layout.
 */
export function packLayout(
  scored: ScoredTask[],
  width: number,
  height: number
): LayoutItem[] {
  if (scored.length === 0) return [];

  // Caller supplies tasks in score-desc order; first one is the top.
  const items = scored.map((t, i) => makeItem(t, i === 0));

  // Pack radius accounts for ring padding around the top task.
  const inputs = items.map((it) => ({
    ref: it,
    r: it.visualR + (it.isTop ? TOP_RING_PAD : NEIGHBOR_PAD),
  }));

  const placed: { ref: (typeof items)[number]; r: number; x: number; y: number }[] = [];
  const cx = width / 2;
  const cy = height / 2;
  const sorted = [...inputs].sort((a, b) => b.r - a.r);

  for (const item of sorted) {
    if (placed.length === 0) {
      placed.push({ ...item, x: cx, y: cy });
      continue;
    }

    let ok = false;
    for (let radius = item.r + 6; radius < Math.max(width, height) && !ok; radius += 3) {
      const steps = Math.max(16, Math.floor(radius * 0.7));
      for (let i = 0; i < steps && !ok; i++) {
        const ang = (i / steps) * Math.PI * 2 + radius * 0.13;
        const x = cx + Math.cos(ang) * radius;
        const y = cy + Math.sin(ang) * radius;

        if (
          x - item.r < EDGE_INSET ||
          x + item.r > width - EDGE_INSET ||
          y - item.r < EDGE_INSET ||
          y + item.r > height - EDGE_INSET
        ) {
          continue;
        }

        const overlaps = placed.some(
          (p) => Math.hypot(p.x - x, p.y - y) < p.r + item.r + 4
        );
        if (!overlaps) {
          placed.push({ ...item, x, y });
          ok = true;
        }
      }
    }
    if (!ok) {
      // Fallback: stack at center (only happens if viewport is too small)
      placed.push({ ...item, x: cx, y: cy });
    }
  }

  // Map placements back to LayoutItems with positions.
  return items.map((it) => {
    const p = placed.find((p) => p.ref === it)!;
    return { ...it, x: p.x, y: p.y };
  });
}

export type LobePosition = { cat: Category; x: number; y: number; r: number };

/**
 * For a multi-category bubble: compute lobe centers (one per category),
 * radiating from the bubble center, evenly spaced.
 */
export function lobePositions(item: LayoutItem): LobePosition[] {
  const lobeR = item.r * 0.78;
  const offset = item.r * 0.42;
  return item.cats.map((cat, i) => {
    const ang = (i / item.cats.length) * Math.PI * 2 - Math.PI / 2;
    return {
      cat,
      x: item.x + Math.cos(ang) * offset,
      y: item.y + Math.sin(ang) * offset,
      r: lobeR,
    };
  });
}
