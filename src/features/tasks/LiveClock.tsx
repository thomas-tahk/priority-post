"use client";

import { useEffect, useState } from "react";

function format(d: Date): string {
  const time = d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  const date = d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  return `${time} · ${date}`;
}

export function LiveClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | undefined;
    const immediateId = setTimeout(() => setNow(new Date()), 0);
    const msToNextMinute = 60_000 - (Date.now() % 60_000);
    const alignId = setTimeout(() => {
      setNow(new Date());
      intervalId = setInterval(() => setNow(new Date()), 60_000);
    }, msToNextMinute);
    return () => {
      clearTimeout(immediateId);
      clearTimeout(alignId);
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  return (
    <span className="app-clock" suppressHydrationWarning>
      {now ? format(now) : ""}
    </span>
  );
}
