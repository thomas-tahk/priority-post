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
  /** The user's calendar day this tick belongs to, in their zone. */
  digestDay: string;
};

/** What an hourly tick should do right now.
 *
 * The digest is not scheduled for an hour; it is owed for a day. Asking "is it
 * past the digest time and has today's gone out?" means a tick the runner
 * skipped — GitHub's schedules drift and can be dropped entirely under load —
 * fires an hour late instead of never.
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
  const today = dayKeyIn(now, timezone);

  const minutesNow = hourIn(now, timezone) * 60 + minuteIn(now, timezone);
  const minutesDue = schedule.digestHour * 60 + schedule.digestMinute;

  return {
    sendDigest: minutesNow >= minutesDue && lastDigestDay !== today,
    sendDueSoon: isWithinActiveHours(
      now,
      { startHour: schedule.activeStartHour, endHour: schedule.activeEndHour },
      timezone,
    ),
    digestDay: today,
  };
}
