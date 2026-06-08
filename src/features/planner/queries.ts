import { db } from "@/db";
import { tasks, goals, sentReminders, type Task, type Goal } from "@/db/schema";
import { and, isNull, isNotNull, eq } from "drizzle-orm";

export async function loadTasksAndGoals(): Promise<{ tasks: Task[]; goals: Goal[] }> {
  const [taskRows, goalRows] = await Promise.all([
    db.select().from(tasks),
    db.select().from(goals),
  ]);
  return { tasks: taskRows, goals: goalRows };
}

export async function getGoal(id: number): Promise<Goal | null> {
  const [row] = await db.select().from(goals).where(eq(goals.id, id));
  return row ?? null;
}

/** Open tasks that have a start_at, paired with the reminder kinds already sent
 *  for each — so the due-soon tick can skip events it has already pinged. */
export async function loadDueSoonState(): Promise<{
  candidates: Task[];
  sent: Set<string>; // `${taskId}:${kind}`
}> {
  const [candidates, sentRows] = await Promise.all([
    db.select().from(tasks).where(and(isNull(tasks.doneAt), isNotNull(tasks.startAt))),
    db.select({ taskId: sentReminders.taskId, kind: sentReminders.kind }).from(sentReminders),
  ]);
  const sent = new Set(sentRows.map((r) => `${r.taskId}:${r.kind}`));
  return { candidates, sent };
}

export async function markReminderSent(taskId: number, kind: string): Promise<void> {
  await db.insert(sentReminders).values({ taskId, kind });
}
