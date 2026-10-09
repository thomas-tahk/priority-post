// The evening check-in: a few tasks asked about with one-tap answers, so the
// list stays true without him having to come back and report. Pure — rows in,
// choices and Discord components out. The route and the tick do the I/O.
import type { Task } from "@/db/schema";
import { dayKeyIn, hourIn, instantAt, minuteIn } from "@/features/planner/clock";

export const CHECKIN_LIMIT = 5; // Discord allows 5 button rows; more would be ignored anyway
const QUIET_DAYS = 7; // an unscheduled task is asked about at most once a week
const DEFAULT_HOUR = 9; // "tomorrow" for a task with no time of its own
const DAY = 86_400_000;

export type CheckInAction = "done" | "tomorrow" | "keep" | "drop";
const ACTIONS: readonly CheckInAction[] = ["done", "tomorrow", "keep", "drop"];
const PREFIX = "checkin";

/** What to ask about tonight, most pressing first.
 *
 * Anything scheduled up to the end of today comes first — those are the ones
 * that may already have happened. Then the unscheduled tasks nobody has asked
 * about longest. Asking stamps `checkedAt`, so ignoring a question rotates the
 * task to the back instead of repeating the same five every night. */
export function pickCheckIn(tasks: Task[], now: Date, timezone: string): Task[] {
  const endOfToday = instantAt(nextDayKey(dayKeyIn(now, timezone)), 0, 0, timezone);
  const open = tasks.filter((t) => t.doneAt === null);

  const due = open
    .filter((t) => t.startAt !== null && t.startAt < endOfToday)
    .sort((a, b) => a.startAt!.getTime() - b.startAt!.getTime());

  const quietSince = now.getTime() - QUIET_DAYS * DAY;
  const lastAsked = (t: Task) => (t.checkedAt ?? t.createdAt).getTime();
  const stale = open
    .filter((t) => t.startAt === null && lastAsked(t) <= quietSince)
    .sort((a, b) => lastAsked(a) - lastAsked(b));

  return [...due, ...stale].slice(0, CHECKIN_LIMIT);
}

/** Tomorrow, at the task's own time of day if it has one. Measured from now,
 *  not from the old date: "tomorrow" on a task three days late means tomorrow. */
export function tomorrowFor(task: { startAt: Date | null }, now: Date, timezone: string): Date {
  const day = nextDayKey(dayKeyIn(now, timezone));
  if (!task.startAt) return instantAt(day, DEFAULT_HOUR, 0, timezone);
  return instantAt(day, hourIn(task.startAt, timezone), minuteIn(task.startAt, timezone), timezone);
}

function nextDayKey(dayKey: string): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) + DAY).toISOString().slice(0, 10);
}

export function customId(action: CheckInAction, taskId: number): string {
  return `${PREFIX}:${action}:${taskId}`;
}

export function parseCustomId(raw: string | undefined): { action: CheckInAction; taskId: number } | null {
  const [prefix, action, id] = (raw ?? "").split(":");
  const taskId = Number(id);
  if (prefix !== PREFIX || !ACTIONS.includes(action as CheckInAction)) return null;
  if (!Number.isInteger(taskId) || taskId <= 0) return null;
  return { action: action as CheckInAction, taskId };
}
