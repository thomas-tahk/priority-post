// Pure objective logic. No DB, no I/O — rows in, decisions out, same contract
// as the planner's digest module.
//
// Two shapes, deliberately scored differently:
//   gate  — binary and dated. A date somebody else set. Days left is the answer.
//   track — no finish line. A weekly count, or a milestone, is the answer.
import type { Goal, Task } from "@/db/schema";
import { dayKeyIn } from "@/features/planner/clock";

/** A deadline is "hard" only when someone other than him set the date. That
 *  distinction is the whole filter: self-set targets go in the digest and are
 *  never allowed to interrupt. */
export const INTERRUPT_WINDOW_DAYS = 3;

export type Gate = {
  id: number;
  name: string;
  targetDate: string;
  daysLeft: number;
};

export type Track = {
  id: number;
  name: string;
  milestone: string | null;
  /** null when the track has no weekly target — a milestone-only track. */
  weekly: { done: number; target: number } | null;
};

const DAY = 86_400_000;

/** Calendar-day difference between two `YYYY-MM-DD` keys.
 *
 * Done on keys rather than instants so a DST boundary inside the range cannot
 * make a day vanish or double. */
export function daysBetween(fromKey: string, toKey: string): number {
  return Math.round((keyToUtc(toKey) - keyToUtc(fromKey)) / DAY);
}

function keyToUtc(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

/** The Monday of `now`'s week, as a `YYYY-MM-DD` key in `timezone`.
 *
 * His week is Monday to Sunday — he said so when he put applications on
 * Fridays. A Sunday-start week would report Friday's work as next week's. */
export function weekStartKey(now: Date, timezone: string): string {
  const todayKey = dayKeyIn(now, timezone);
  const weekday = new Date(keyToUtc(todayKey)).getUTCDay(); // 0 = Sunday
  const backToMonday = (weekday + 6) % 7;
  return utcToKey(keyToUtc(todayKey) - backToMonday * DAY);
}

function utcToKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Tasks for this goal completed in the current Mon-Sun week. */
export function weeklyCount(
  goalId: number,
  tasks: Task[],
  now: Date,
  timezone: string,
): number {
  const from = weekStartKey(now, timezone);
  const to = dayKeyIn(now, timezone);
  return tasks.filter(
    (t) =>
      t.goalId === goalId &&
      t.doneAt !== null &&
      isWithin(dayKeyIn(t.doneAt, timezone), from, to),
  ).length;
}

function isWithin(key: string, from: string, to: string): boolean {
  return key >= from && key <= to; // ISO dates sort lexicographically
}

/** Dated objectives, soonest first. Ones whose date has passed are dropped:
 *  a gate is met or missed, and either way a negative countdown is noise. */
export function gates(goals: Goal[], now: Date, timezone: string): Gate[] {
  const todayKey = dayKeyIn(now, timezone);
  return goals
    .filter((g) => g.kind === "gate" && g.targetDate !== null)
    .map((g) => ({
      id: g.id,
      name: g.name,
      targetDate: g.targetDate as string,
      daysLeft: daysBetween(todayKey, g.targetDate as string),
    }))
    .filter((g) => g.daysLeft >= 0)
    .sort((a, b) => a.daysLeft - b.daysLeft);
}

/** Progress-shaped objectives with their week so far. */
export function tracks(
  goals: Goal[],
  tasks: Task[],
  now: Date,
  timezone: string,
): Track[] {
  return goals
    .filter((g) => g.kind !== "gate")
    .map((g) => ({
      id: g.id,
      name: g.name,
      milestone: g.milestone,
      weekly:
        g.weeklyTarget === null
          ? null
          : { done: weeklyCount(g.id, tasks, now, timezone), target: g.weeklyTarget },
    }));
}

/** The only objectives allowed to interrupt: a hard deadline inside 72 hours.
 *
 * Everything else waits for the digest. If this predicate ever grows a second
 * clause, the lead has stopped filtering. */
export function interrupting(gates: Gate[]): Gate[] {
  return gates.filter((g) => g.daysLeft <= INTERRUPT_WINDOW_DAYS);
}

/** Tracks that missed their weekly target, for the end-of-week read.
 *
 * Says the number and nothing else. No streaks, no escalation — the target is
 * fixed for the window, so a miss is a fact, not a reason to move it. */
export function missedWeekly(tracks: Track[]): Track[] {
  return tracks.filter((t) => t.weekly !== null && t.weekly.done < t.weekly.target);
}
