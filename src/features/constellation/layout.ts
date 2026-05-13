import type { Task } from "@/db/schema";
import type { Category } from "@/features/tasks/categories";
import { DEFAULTS } from "@/features/tasks/scorer";

export type ScoredTask = Task & { _score: number };

export type Placement = {
  task: ScoredTask;
  primaryCat: Category;
  cats: Category[];
  isTop: boolean;
  x: number;
  y: number;
  r: number;
};

export const PADDING = 56; // room for corner quadrant labels
export const MIN_R = 8;
export const MAX_R = 32;
const JITTER_AMPLITUDE = 14;

/**
 * Eisenhower-style placement: x maps urgency 0..100, y maps importance 0..100
 * (inverted so high importance is at the top of the SVG). Tasks at identical
 * coords get a small deterministic jitter (seeded by task id) so they don't
 * perfectly overlap. Bubble size encodes est_time_min — effort, not priority,
 * so it doesn't duplicate position.
 */
export function placeOnMap(
  scored: ScoredTask[],
  width: number,
  height: number
): Placement[] {
  if (scored.length === 0) return [];

  const innerW = Math.max(1, width - PADDING * 2);
  const innerH = Math.max(1, height - PADDING * 2);

  return scored.map((task, i) => {
    const u = task.urgency ?? DEFAULTS.urgency;
    const imp = task.importance ?? DEFAULTS.importance;

    const baseX = PADDING + (u / 100) * innerW;
    const baseY = PADDING + ((100 - imp) / 100) * innerH;

    // Deterministic jitter — tiny offset based on task id so coincident
    // (urgency, importance) tasks don't sit on top of each other.
    const jx = jitter(task.id, 1) * JITTER_AMPLITUDE;
    const jy = jitter(task.id, 7) * JITTER_AMPLITUDE;

    const cats = task.categories as Category[];
    const primaryCat = cats[0] ?? ("other" as Category);

    return {
      task,
      primaryCat,
      cats,
      isTop: i === 0,
      x: baseX + jx,
      y: baseY + jy,
      r: radiusFromEstTime(task.estTimeMin),
    };
  });
}

/**
 * Hash a task id to a stable [-1, 1] value. Different `salt` produces an
 * independent sequence (used to get jx and jy from the same id).
 */
function jitter(id: number, salt: number): number {
  // Simple integer hash; output fits in a small range and is deterministic.
  const x = Math.sin(id * 9301 + salt * 49297) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}

/**
 * Map est_time_min to a bubble radius. sqrt curve so a 3-hour task isn't 6x
 * a 30-min task — it's about 2.5x. Clamped to [MIN_R, MAX_R].
 */
export function radiusFromEstTime(min: number | null): number {
  const m = min ?? 30;
  const r = MIN_R + Math.sqrt(Math.max(1, m)) * 1.4;
  return Math.max(MIN_R, Math.min(MAX_R, r));
}
