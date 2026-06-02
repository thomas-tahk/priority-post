// Fractional position helpers for manual task ordering.

/** Position that lands a task between two neighbors (null = list edge). */
export function midpoint(prevPos: number | null, nextPos: number | null): number {
  if (prevPos !== null && nextPos !== null) return (prevPos + nextPos) / 2;
  if (prevPos !== null) return prevPos + 1;
  if (nextPos !== null) return nextPos - 1;
  return 0;
}
