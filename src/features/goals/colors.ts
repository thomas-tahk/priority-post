// Goal dots reuse the locked category color CSS vars. `color` is a category key.
export const GOAL_COLORS = [
  "work", "personal", "health", "learning", "errands", "side_project", "other",
] as const;

export function CAT_COLOR_VAR(key: string): string {
  return `var(--cat-${key})`;
}
