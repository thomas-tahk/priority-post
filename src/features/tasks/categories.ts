export const CATEGORIES = [
  "work",
  "personal",
  "health",
  "learning",
  "errands",
  "side_project",
  "other",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  work: "Work",
  personal: "Personal",
  health: "Health",
  learning: "Learning",
  errands: "Errands",
  side_project: "Side project",
  other: "Other",
};

export function isCategory(s: string): s is Category {
  return (CATEGORIES as readonly string[]).includes(s);
}

export function ensureAtLeastOne(cats: string[]): Category[] {
  const valid = cats.filter(isCategory);
  return valid.length > 0 ? valid : ["other"];
}
