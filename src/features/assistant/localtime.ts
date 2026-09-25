/** The current moment as the owner would read it off a clock, plus the UTC
 * offset that applies right then.
 *
 * The agent used to infer the offset from `now.toString()`, which renders in
 * whatever zone the process happens to run in. That was fine on a rented
 * always-on host where `TZ` could be set. Vercel functions are UTC and cannot
 * be changed, so the same prompt on this infrastructure would tell the model
 * the owner lives in London. Stating the zone by name removes the inference. */
export function describeNow(now: Date, timezone: string): string {
  const wall = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    weekday: "long",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(now);

  return `${wall} (${timezone}, UTC${utcOffset(now, timezone)})`;
}

/** The zone's offset at `now`, as "+HH:MM" / "-HH:MM".
 *
 * Read from the formatter rather than hardcoded, so it is right on both sides
 * of a daylight-saving change instead of six months of the year. */
export function utcOffset(now: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    timeZoneName: "longOffset",
  }).formatToParts(now);

  const name = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  // Intl renders exactly UTC as bare "GMT"; every other zone as "GMT-06:00".
  const offset = name.replace("GMT", "");
  return offset === "" ? "+00:00" : offset;
}
