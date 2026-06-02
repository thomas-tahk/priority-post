"use server";

import { db } from "@/db";
import { goals, tasks } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { validateDisposition, type Disposition } from "./disposition";

export async function createGoal(input: {
  name: string;
  color: string;
  description?: string;
}) {
  const name = input.name.trim();
  if (!name) return;
  await db.insert(goals).values({
    name,
    color: input.color,
    description: input.description?.trim() || null,
  });
  revalidatePath("/");
}

export async function updateGoal(
  id: number,
  patch: { name?: string; description?: string | null; color?: string }
) {
  const set: Partial<typeof goals.$inferInsert> = {};
  if (patch.name !== undefined) {
    const name = patch.name.trim();
    if (!name) return;
    set.name = name;
  }
  if (patch.description !== undefined) {
    set.description = patch.description?.trim() || null;
  }
  if (patch.color !== undefined) set.color = patch.color;
  if (Object.keys(set).length === 0) return;
  await db.update(goals).set(set).where(eq(goals.id, id));
  revalidatePath("/");
}

export async function assignTaskGoal(taskId: number, goalId: number | null) {
  await db.update(tasks).set({ goalId }).where(eq(tasks.id, taskId));
  revalidatePath("/");
}

export async function deleteGoal(id: number, disposition: Disposition) {
  const d = validateDisposition(disposition, id);

  if (d.kind === "unassign") {
    await db.update(tasks).set({ goalId: null }).where(eq(tasks.goalId, id));
  } else if (d.kind === "reassign") {
    await db.update(tasks).set({ goalId: d.targetGoalId }).where(eq(tasks.goalId, id));
  } else {
    await db.delete(tasks).where(eq(tasks.goalId, id));
  }

  await db.delete(goals).where(eq(goals.id, id));
  revalidatePath("/");
}
