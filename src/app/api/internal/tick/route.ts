import { NextRequest } from "next/server";
import { requireInternalSecret } from "@/features/planner/internal-auth";
import {
  lastDigestDay,
  loadDueSoonState,
  loadTasksAndGoals,
  markDigestSent,
  markReminderSent,
} from "@/features/planner/queries";
import { buildDigest, dueWindow, toCompact } from "@/features/planner/digest";
import { formatEveningDigest } from "@/features/planner/digestMessage";
import { postToDiscord } from "@/features/planner/discord";
import { appTimezone } from "@/features/planner/clock";
import { decideTick, type TickSchedule } from "@/features/planner/tick";
import { fetchInbox } from "@/features/foundry/source";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The only thing on a timer. A GitHub Actions cron calls this once an hour; the
// workflow itself is fixed and never edited, because what the tick does is
// runtime state and what it is is infrastructure.
export async function POST(req: NextRequest) {
  const denied = requireInternalSecret(req);
  if (denied) return denied;

  const now = new Date();
  const timezone = appTimezone();
  const schedule = readSchedule();
  const decision = decideTick({ now, timezone, schedule, lastDigestDay: await lastDigestDay() });

  const did: string[] = [];

  if (decision.sendDigest) {
    const [{ tasks, goals }, inbox] = await Promise.all([loadTasksAndGoals(), fetchInbox()]);
    const factory = inbox.ok ? inbox.items : [];
    const posted = await postToDiscord(formatEveningDigest(buildDigest(tasks, goals, now), factory));
    if (posted.ok) {
      await markDigestSent(decision.digestDay);
      did.push(`digest for ${decision.digestDay}`);
    } else {
      // Not marked sent, so the next tick tries again rather than skipping the day.
      return Response.json({ error: posted.reason, decision }, { status: 502 });
    }
  }

  if (decision.sendDueSoon) {
    did.push(...(await sendDueSoonPings(now)));
  }

  return Response.json({ decision, did });
}

async function sendDueSoonPings(now: Date): Promise<string[]> {
  const { candidates, sent } = await loadDueSoonState();
  const done: string[] = [];

  for (const task of candidates) {
    const kind = dueWindow(task, now);
    if (!kind || sent.has(`${task.id}:${kind}`)) continue;

    const compact = toCompact(task, now);
    const stamp = compact.startAt ? Math.floor(Date.parse(compact.startAt) / 1000) : 0;
    const text =
      kind === "due_soon"
        ? `⏳ **${compact.title}** is coming up <t:${stamp}:R>.`
        : `🔴 **${compact.title}** just slipped past its time. Still on?`;

    const posted = await postToDiscord(text);
    if (!posted.ok) break;
    await markReminderSent(task.id, kind);
    done.push(`${kind} for task ${task.id}`);
  }

  return done;
}

function readSchedule(): TickSchedule {
  return {
    digestHour: intInRange(process.env.DIGEST_HOUR, 18, 0, 23),
    digestMinute: intInRange(process.env.DIGEST_MINUTE, 0, 0, 59),
    activeStartHour: intInRange(process.env.ACTIVE_START_HOUR, 16, 0, 23),
    activeEndHour: intInRange(process.env.ACTIVE_END_HOUR, 22, 0, 23),
  };
}

function intInRange(raw: string | undefined, fallback: number, min: number, max: number): number {
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) return fallback;
  return value;
}
