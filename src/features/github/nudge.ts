import { needsYou, type TrackedItem } from "./grouping";

const APP_URL = "https://priority-post.vercel.app";
const DAY_MS = 24 * 60 * 60 * 1000;

/** The daily Discord nudge, or null when nothing new needs you (stay quiet). */
export function buildNudge(items: TrackedItem[], now: Date): string | null {
  const waiting = items.filter(needsYou);
  const fresh = waiting.filter((i) => now.getTime() - new Date(i.createdAt).getTime() < DAY_MS);
  if (fresh.length === 0) return null;
  const things = fresh.length === 1 ? "thing needs" : "things need";
  return `🔔 ${fresh.length} new ${things} you (${waiting.length} total) → ${APP_URL}`;
}
