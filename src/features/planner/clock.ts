// Every time question this app asks is asked in a named zone, never in whatever
// zone the process happens to run in.
//
// This matters more here than it did on a long-running host. GitHub Actions
// runners and Vercel functions are both UTC, and Vercel's cannot be changed, so
// an ambient `TZ` would put the evening digest at lunchtime and resolve
// "friday 3pm" six hours off — a bug that once scored the agent's eval 27/40
// with every failure exactly one hour wide.

export const DEFAULT_TIMEZONE = "America/Denver";

/** The configured zone. Never falls back to the process zone. */
export function appTimezone(): string {
  return process.env.APP_TIMEZONE || DEFAULT_TIMEZONE;
}

function partsIn(now: Date, timezone: string): Record<string, string> {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  return Object.fromEntries(parts.map((p) => [p.type, p.value]));
}

/** The hour 0-23 as read in `timezone`. */
export function hourIn(now: Date, timezone: string): number {
  return Number(partsIn(now, timezone).hour);
}

/** The minute 0-59 as read in `timezone`. */
export function minuteIn(now: Date, timezone: string): number {
  return Number(partsIn(now, timezone).minute);
}

/** The calendar day as read in `timezone`, as `YYYY-MM-DD`.
 *
 * This is what "has today's digest gone out?" is asked about, so it has to be
 * the user's today and not the runner's. */
export function dayKeyIn(now: Date, timezone: string): string {
  const p = partsIn(now, timezone);
  return `${p.year}-${p.month}-${p.day}`;
}

/** True when `now` falls in [startHour, endHour) as read in `timezone`.
 *
 * A window whose start is after its end wraps midnight. Equal bounds mean "no
 * quiet hours" — an empty window would silently mute every reminder forever,
 * a worse failure than one ping at an odd hour. */
export function isWithinActiveHours(
  now: Date,
  window: { startHour: number; endHour: number },
  timezone: string,
): boolean {
  const { startHour, endHour } = window;
  if (startHour === endHour) return true;
  const hour = hourIn(now, timezone);
  return startHour < endHour
    ? hour >= startHour && hour < endHour
    : hour >= startHour || hour < endHour;
}
