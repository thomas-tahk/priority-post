import { NextRequest } from "next/server";
import { requireInternalSecret } from "@/features/planner/internal-auth";
import { loadDueSoonState } from "@/features/planner/queries";
import { dueWindow, toCompact } from "@/features/planner/digest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Tasks entering the due-soon / overdue window that have NOT been pinged yet.
// The bot posts each, then calls /reminders/mark so it never repeats.
export async function GET(req: NextRequest) {
  const denied = requireInternalSecret(req);
  if (denied) return denied;

  const now = new Date();
  const { candidates, sent } = await loadDueSoonState();

  const events = candidates.flatMap((task) => {
    const kind = dueWindow(task, now);
    if (!kind || sent.has(`${task.id}:${kind}`)) return [];
    return [{ kind, task: toCompact(task, now) }];
  });

  return Response.json({ events });
}
