// Fractional position helpers for manual task ordering.

import { sortByScore, type TaskForScoring } from "./scorer";

/** Position that lands a task between two neighbors (null = list edge). */
export function midpoint(prevPos: number | null, nextPos: number | null): number {
  if (prevPos !== null && nextPos !== null) return (prevPos + nextPos) / 2;
  if (prevPos !== null) return prevPos + 1;
  if (nextPos !== null) return nextPos - 1;
  return 0;
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
