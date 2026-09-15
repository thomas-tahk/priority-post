import { dayKeyIn, hourIn, isWithinActiveHours, minuteIn } from "./clock";

export type TickSchedule = {
  digestHour: number;
  digestMinute: number;
  activeStartHour: number;
  activeEndHour: number;
};

export type TickDecision = {
  sendDigest: boolean;
  sendDueSoon: boolean;
  /** The day whose digest is owed right now, in the user's zone. */
  digestDay: string;
};

/** The calendar day before a "YYYY-MM-DD" key.
 *
 * Pure calendar arithmetic rather than subtracting 24 hours from an instant, so
 * the answer is the same on the two days a year that are 23 or 25 hours long. */
function previousDay(dayKey: string): string {
  const [year, month, day] = dayKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day - 1)).toISOString().slice(0, 10);
}

/** Which day's digest is owed at this moment.
 *
 * Before the digest time, the newest digest that should already exist is
 * yesterday's; after it, today's. Naming the owed day this way is what keeps a
 * skipped evening from being lost: at 1am the owed day is still yesterday, so a
 * tick that finally runs after midnight sends the message it missed instead of
 * deciding the day is over. */
function owedDigestDay(now: Date, timezone: string, schedule: TickSchedule): string {
  const today = dayKeyIn(now, timezone);
  const minutesNow = hourIn(now, timezone) * 60 + minuteIn(now, timezone);
  const minutesDue = schedule.digestHour * 60 + schedule.digestMinute;

  return minutesNow >= minutesDue ? today : previousDay(today);
}

/** What an hourly tick should do right now.
 *
 * The digest is not scheduled for an hour; it is owed for a day, and it stays
 * owed until it is sent. GitHub's schedules drift and are dropped under load —
 * in practice only a handful of the day's ticks run — so the question has to be
 * one that a late tick can still answer "yes" to. Asking "is today's sent yet?"
 * silently abandoned the day at midnight; asking "is the owed day's sent yet?"
 * gives every tick in the following twenty-four hours a chance to deliver it.
 *
 * Due-soon pings are the opposite: outside the active window they are dropped,
 * not queued. A ping about something due at 10am delivered at 5pm is noise. */
export function decideTick(input: {
  now: Date;
  timezone: string;
  schedule: TickSchedule;
  lastDigestDay: string | null;
}): TickDecision {
  const { now, timezone, schedule, lastDigestDay } = input;
  const digestDay = owedDigestDay(now, timezone, schedule);

  return {
    sendDigest: lastDigestDay !== digestDay,
    sendDueSoon: isWithinActiveHours(
      now,
      { startHour: schedule.activeStartHour, endHour: schedule.activeEndHour },
      timezone,
    ),
    digestDay,
  };
}

/** How many evenings went by without a digest before the one now being sent.
 *
 * Zero on a normal night. Anything higher is the scheduler having dropped runs,
 * and the digest says so out loud — a quiet channel otherwise looks the same as
 * a channel with nothing to report. */
export function missedDigestDays(lastDigestDay: string | null, owedDay: string): number {
  if (!lastDigestDay) return 0;

  const gap = Date.parse(`${owedDay}T00:00:00Z`) - Date.parse(`${lastDigestDay}T00:00:00Z`);
  if (Number.isNaN(gap)) return 0;

  return Math.max(0, Math.round(gap / 86_400_000) - 1);
}
