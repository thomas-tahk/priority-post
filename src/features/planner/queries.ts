import { db } from "@/db";
import { tasks, goals, sentReminders, sentDigests, activity, type Task, type Goal, type Activity } from "@/db/schema";
import { and, isNull, isNotNull, eq, desc, asc, gt } from "drizzle-orm";

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


/** The most recent day the evening digest actually went out, in the user's zone. */
export async function lastDigestDay(): Promise<string | null> {
  const rows = await db.select().from(sentDigests).orderBy(desc(sentDigests.day)).limit(1);
  return rows[0]?.day ?? null;
}

/** Record that today's digest went out. Writing the day before posting would
 * lose a digest to a failed post; writing it after can only ever repeat one. */
export async function markDigestSent(day: string): Promise<void> {
  await db.insert(sentDigests).values({ day }).onConflictDoNothing();
}

export async function recordActivity(entry: { actor: string; summary: string }): Promise<Activity> {
  const [row] = await db.insert(activity).values(entry).returning();
  return row;
}

/** What the assistant logged since the last digest went out, or in the last
 * day when none ever has. */
export async function activitySinceLastDigest(now: Date): Promise<Activity[]> {
  const [last] = await db.select().from(sentDigests).orderBy(desc(sentDigests.sentAt)).limit(1);
  const since = last?.sentAt ?? new Date(now.getTime() - 24 * 60 * 60 * 1000);
  return db.select().from(activity).where(gt(activity.at, since)).orderBy(asc(activity.at));
}
