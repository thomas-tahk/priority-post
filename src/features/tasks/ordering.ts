// Fractional position helpers for manual task ordering.

import { sortByScore, type TaskForScoring } from "./scorer";

/** Position that lands a task between two neighbors (null = list edge). */
export function midpoint(prevPos: number | null, nextPos: number | null): number {
  if (prevPos !== null && nextPos !== null) return (prevPos + nextPos) / 2;
  if (prevPos !== null) return prevPos + 1;
  if (nextPos !== null) return nextPos - 1;
  return 0;
}

/** Collision-free position to drop a task just AFTER prevPos (null = top of list). */
export function positionAfter(prevPos: number | null, allPositions: number[]): number {
  if (prevPos === null) {
    return allPositions.length ? Math.min(...allPositions) - 1 : 0;
  }
  const above = allPositions.filter((p) => p > prevPos);
  return midpoint(prevPos, above.length ? Math.min(...above) : null);
}

/** Collision-free position to drop a task just BEFORE nextPos (null = bottom of list). */
export function positionBefore(nextPos: number | null, allPositions: number[]): number {
  if (nextPos === null) {
    return allPositions.length ? Math.max(...allPositions) + 1 : 0;
  }
  const below = allPositions.filter((p) => p < nextPos);
  return midpoint(below.length ? Math.max(...below) : null, nextPos);
}

/**
 * List order for open tasks: tasks the user has hand-placed come first (by
 * ascending position); everything else falls back to the deterministic scorer.
 * When nothing is positioned, this is exactly the scorer's order.
 */
export function orderOpenTasks<T extends TaskForScoring & { position: number | null }>(
  tasks: T[],
  now: Date
): T[] {
  const positioned = tasks.filter((t) => t.position !== null);
  const unpositioned = tasks.filter((t) => t.position === null);
  positioned.sort((a, b) => a.position! - b.position!);
  return [...positioned, ...sortByScore(unpositioned, now)];
}
