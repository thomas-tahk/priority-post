// Quiet hours for due-soon pings. Pure, so the window logic is unit-testable
// without waiting for a clock. Reminders outside the window are skipped, not
// queued — a 10am ping delivered at 5pm is stale noise, not a save.

function hourIn(now: Date, timezone: string): number {
  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    hourCycle: "h23",
  }).format(now);
  return Number(formatted);
}

/**
 * True when `now` falls in [startHour, endHour) as read in `timezone`.
 * A window whose start is after its end wraps midnight (22 → 6 covers 22:00-05:59).
 * Equal bounds mean "no quiet hours" — an empty window would silently mute every
 * reminder forever, a worse failure than one ping at an odd hour.
 */
export function isWithinActiveHours(
  now: Date,
  startHour: number,
  endHour: number,
  timezone: string
): boolean {
  if (startHour === endHour) return true;

  const hour = hourIn(now, timezone);
  return startHour < endHour
    ? hour >= startHour && hour < endHour
    : hour >= startHour || hour < endHour;
}
