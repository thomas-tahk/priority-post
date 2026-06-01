const DAY = 86_400_000;

export function startedAgo(from: Date, now: Date): string {
  const days = Math.floor((now.getTime() - from.getTime()) / DAY);
  if (days <= 0) return "today";
  if (days < 7) return plural(days, "day");
  if (days < 30) return plural(Math.floor(days / 7), "week");
  return plural(Math.floor(days / 30), "month");
}

function plural(n: number, unit: string): string {
  return `${n} ${unit}${n === 1 ? "" : "s"} ago`;
}
