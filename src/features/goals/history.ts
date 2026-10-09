// Pure goal-history logic: done tasks in, Mon-Sun weeks out. No DB, no I/O.
//
// Weeks are read in the app zone, same as the weekly target in objectives.ts —
// a task closed Sunday night must count for the week it was done in.
import type { Task } from "@/db/schema";
import { dayKeyIn } from "@/features/planner/clock";
import { daysBetween, weekStartKey } from "./objectives";

export type HistoryWeek = { startKey: string; tasks: Task[] };

/** The trend strip's width. The timeline reaches back further if there is more. */
export const TREND_WEEKS = 12;

const DAY = 86_400_000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Done tasks bucketed by week, this week first, newest task first inside each.
 *
 * Empty weeks are kept: a gap is part of the history, not something to hide. */
export function weeklyHistory(done: Task[], now: Date, timezone: string): HistoryWeek[] {
  const thisWeek = weekStartKey(now, timezone);
  const indexOf = (t: Task) =>
    Math.max(0, Math.floor(daysBetween(weekStartKey(t.doneAt!, timezone), thisWeek) / 7));

  const count = Math.max(TREND_WEEKS, ...done.map((t) => indexOf(t) + 1));
  const weeks: HistoryWeek[] = Array.from({ length: count }, (_, i) => ({
    startKey: addDays(thisWeek, -7 * i),
    tasks: [],
  }));
  const newestFirst = [...done].sort((a, b) => b.doneAt!.getTime() - a.doneAt!.getTime());
  for (const t of newestFirst) weeks[indexOf(t)]!.tasks.push(t);
  return weeks;
}

/** "This week", "Last week", then "Sep 21 – 27" / "Sep 28 – Oct 4". */
export function weekLabel(index: number, startKey: string): string {
  if (index === 0) return "This week";
  if (index === 1) return "Last week";
  const [, sm, sd] = startKey.split("-").map(Number);
  const [, em, ed] = addDays(startKey, 6).split("-").map(Number);
  const end = em === sm ? `${ed}` : `${MONTHS[em! - 1]} ${ed}`;
  return `${MONTHS[sm! - 1]} ${sd} – ${end}`;
}

/** Calendar days a task stayed open, in the app zone. */
export function daysOpen(task: Task, timezone: string): number {
  return daysBetween(dayKeyIn(task.createdAt, timezone), dayKeyIn(task.doneAt!, timezone));
}

/** "Oct 4", as read in the app zone. */
export function shortDate(date: Date, timezone: string): string {
  return keyDate(dayKeyIn(date, timezone));
}

/** "Nov 14" for a `YYYY-MM-DD` key. */
export function keyDate(key: string): string {
  const [, m, d] = key.split("-").map(Number);
  return `${MONTHS[m! - 1]} ${d}`;
}

function addDays(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!) + days * DAY).toISOString().slice(0, 10);
}
