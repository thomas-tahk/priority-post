"use server";

import { db } from "@/db";
import { tasks } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { ensureAtLeastOne, type Category } from "./categories";

export async function createTask(input: { title: string; categories?: string[] }) {
  const title = input.title.trim();
  if (!title) return;

  await db.insert(tasks).values({
    title,
    categories: ensureAtLeastOne(input.categories ?? []),
  });
  revalidatePath("/");
}

export async function updateTaskTitle(id: number, title: string) {
  const trimmed = title.trim();
  if (!trimmed) return;
  await db.update(tasks).set({ title: trimmed }).where(eq(tasks.id, id));
  revalidatePath("/");
}

export async function setTaskCategories(id: number, categories: string[]) {
  const next = ensureAtLeastOne(categories);
  await db.update(tasks).set({ categories: next }).where(eq(tasks.id, id));
  revalidatePath("/");
}

export async function addTaskCategory(id: number, category: Category) {
  await db
    .update(tasks)
    .set({
      categories: sql`(
        CASE WHEN ${category} = ANY(${tasks.categories})
          THEN ${tasks.categories}
          ELSE array_append(${tasks.categories}, ${category})
        END
      )`,
    })
    .where(eq(tasks.id, id));
  revalidatePath("/");
}

export async function removeTaskCategory(id: number, category: Category) {
  const [row] = await db
    .select({ categories: tasks.categories })
    .from(tasks)
    .where(eq(tasks.id, id));
  if (!row) return;

  const remaining = row.categories.filter((c) => c !== category);
  const next = ensureAtLeastOne(remaining);
  await db.update(tasks).set({ categories: next }).where(eq(tasks.id, id));
  revalidatePath("/");
}

export async function toggleTaskDone(id: number, done: boolean) {
  await db
    .update(tasks)
    .set({ doneAt: done ? new Date() : null })
    .where(eq(tasks.id, id));
  revalidatePath("/");
}

export async function deleteTask(id: number) {
  await db.delete(tasks).where(eq(tasks.id, id));
  revalidatePath("/");
}
