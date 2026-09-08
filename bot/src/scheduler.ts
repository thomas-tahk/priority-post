import cron from "node-cron";
import type { PlannerApi } from "./api.js";
import { formatDigest, formatDueEvent } from "./format.js";
import { isWithinActiveHours } from "./quiet.js";

type SchedulerOpts = {
  api: PlannerApi;
  send: (text: string) => Promise<void>;
  digestHour: number;
  digestMinute: number;
  activeStartHour: number;
  activeEndHour: number;
  timezone?: string;
};

type SweepOpts = {
  api: PlannerApi;
  send: (text: string) => Promise<void>;
  now: Date;
  activeStartHour: number;
  activeEndHour: number;
  timezone: string;
};

export function digestCron(hour: number, minute: number): string {
  return `${minute} ${hour} * * *`;
}

/**
 * One due-soon tick. Outside the active window it does nothing at all — not even
 * a query — and the suppressed events are dropped rather than queued. Returns the
 * number of reminders sent.
 */
export async function runDueSoonSweep({
  api,
  send,
  now,
  activeStartHour,
  activeEndHour,
  timezone,
}: SweepOpts): Promise<number> {
  if (!isWithinActiveHours(now, activeStartHour, activeEndHour, timezone)) return 0;

  let sent = 0;
  for (const event of await api.getDueSoon()) {
    await send(formatDueEvent(event));
    await api.markReminder(event.task.id, event.kind);
    sent++;
  }
  return sent;
}

// Two cron jobs: the daily evening digest, and a due-soon sweep every 15 minutes
// that only speaks up inside the owner's active hours. Dedup for the sweep lives
// in Postgres (sent_reminders), so restarts are safe.
export function startScheduler({
  api,
  send,
  digestHour,
  digestMinute,
  activeStartHour,
  activeEndHour,
  timezone,
}: SchedulerOpts): void {
  const opts = timezone ? { timezone } : undefined;
  const zone = timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;

  cron.schedule(
    digestCron(digestHour, digestMinute),
    async () => {
      try {
        await send(formatDigest(await api.getDigest()));
      } catch (e) {
        console.error("digest tick failed:", e);
      }
    },
    opts
  );

  cron.schedule(
    "*/15 * * * *",
    async () => {
      try {
        await runDueSoonSweep({
          api,
          send,
          now: new Date(),
          activeStartHour,
          activeEndHour,
          timezone: zone,
        });
      } catch (e) {
        console.error("due-soon tick failed:", e);
      }
    },
    opts
  );
}
