import cron from "node-cron";
import type { PlannerApi } from "./api.js";
import { formatDigest, formatDueEvent } from "./format.js";

type SchedulerOpts = {
  api: PlannerApi;
  send: (text: string) => Promise<void>;
  digestHour: number;
  timezone?: string;
};

// Two cron jobs: the daily morning digest, and a due-soon sweep every 15 minutes.
// Dedup for the sweep lives in Postgres (sent_reminders), so restarts are safe.
export function startScheduler({ api, send, digestHour, timezone }: SchedulerOpts): void {
  const opts = timezone ? { timezone } : undefined;

  cron.schedule(
    `0 ${digestHour} * * *`,
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
        for (const event of await api.getDueSoon()) {
          await send(formatDueEvent(event));
          await api.markReminder(event.task.id, event.kind);
        }
      } catch (e) {
        console.error("due-soon tick failed:", e);
      }
    },
    opts
  );
}
