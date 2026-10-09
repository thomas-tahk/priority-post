// The check-in's writes. Each answer goes through the same task actions the web
// app uses, so a tap in Discord and a click in the app cannot disagree.
import { db } from "@/db";
import { tasks } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { deleteTask, setTaskStartAt, toggleTaskDone } from "@/features/tasks/actions";
import { tomorrowFor, type CheckInAction } from "./checkin";

/** Applies one tap. Returns the task's title for the answered row, or null when
 *  the task is gone (deleted in the app since the digest went out). */
export async function applyCheckIn(
  answer: { action: CheckInAction; taskId: number },
  context: { now: Date; timezone: string },
): Promise<string | null> {
  const [task] = await db.select().from(tasks).where(eq(tasks.id, answer.taskId));
  if (!task) return null;

  switch (answer.action) {
    case "done":
      await toggleTaskDone(task.id, true);
      break;
    case "tomorrow":
      await setTaskStartAt(task.id, tomorrowFor(task, context.now, context.timezone));
      break;
    case "keep":
      await markAsked([task.id], context.now);
      break;
    case "drop":
      await deleteTask(task.id);
      break;
  }
  return task.title;
}

/** Stamps the tasks the check-in asked about, answered or not. */
export async function markAsked(ids: number[], now: Date): Promise<void> {
  if (ids.length === 0) return;
  await db.update(tasks).set({ checkedAt: now }).where(inArray(tasks.id, ids));
}
