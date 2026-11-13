export type Label = { name: string; color: string };

export type TrackedItem = {
  repo: string;
  number: number;
  title: string;
  url: string;
  isPr: boolean;
  isDraft: boolean;
  labels: Label[];
  updatedAt: string;
};

export type RepoGroup = { repo: string; items: TrackedItem[] };

export const NEEDS_YOU = "needs-you";
const STALE_DAYS = 7;

export function needsYou(item: TrackedItem): boolean {
  return item.labels.some((l) => l.name === NEEDS_YOU);
}

export function isStale(item: TrackedItem, now: Date): boolean {
  const ageMs = now.getTime() - new Date(item.updatedAt).getTime();
  return ageMs > STALE_DAYS * 24 * 60 * 60 * 1000;
}

function byRecent(a: TrackedItem, b: TrackedItem): number {
  return b.updatedAt.localeCompare(a.updatedAt);
}

/** Repos ordered by most recent activity; items newest first. */
export function groupByRepo(items: TrackedItem[]): RepoGroup[] {
  const groups = new Map<string, TrackedItem[]>();
  for (const item of [...items].sort(byRecent)) {
    const list = groups.get(item.repo) ?? [];
    list.push(item);
    groups.set(item.repo, list);
  }
  return [...groups].map(([repo, list]) => ({ repo, items: list }));
}

export function timeAgo(iso: string, now: Date): string {
  const mins = Math.floor((now.getTime() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${Math.max(mins, 0)}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
