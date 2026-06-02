"use server";

import { db } from "@/db";
import { tasks } from "@/db/schema";
import { eq, sql, and, isNull, isNotNull } from "drizzle-orm";
import { sortByScore } from "./scorer";
import { positionAfter, positionBefore } from "./ordering";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { ensureAtLeastOne, type Category } from "./categories";
import { triageTask } from "@/features/triage/triage";

function pinnedSet(raw: unknown): Set<string> {
  if (Array.isArray(raw)) return new Set(raw.filter((x): x is string => typeof x === "string"));
  return new Set();
}

function pinnedJsonWith(raw: unknown, field: string): string[] {
  const s = pinnedSet(raw);
  s.add(field);
  return Array.from(s);
}

async function pinField(id: number, field: string) {
  const [row] = await db
    .select({ pinnedFields: tasks.pinnedFields })
    .from(tasks)
    .where(eq(tasks.id, id));
  if (!row) return;
  const next = pinnedJsonWith(row.pinnedFields, field);
  await db.update(tasks).set({ pinnedFields: next }).where(eq(tasks.id, id));
}

export async function createTask(input: {
  title: string;
  categories?: string[];
  goalId?: number | null;
}) {
  const title = input.title.trim();
  if (!title) return;

  const userPickedCategories = (input.categories ?? []).length > 0;
  const initialCategories = ensureAtLeastOne(input.categories ?? []);
  const initialPinned = userPickedCategories ? ["categories"] : [];

  // When manual ordering is active, place new tasks at the top of their context:
  // top of Overview, or just above the goal's current tasks. A new task in a goal
  // that has no manual order yet stays unpositioned (the scorer places it) — it
  // must NOT jump to global #1.
  let position: number | null = null;
  const openPositioned = await db
    .select({ position: tasks.position, goalId: tasks.goalId })
    .from(tasks)
    .where(and(isNull(tasks.doneAt), isNotNull(tasks.position)));

  if (openPositioned.length > 0) {
    const allPositions = openPositioned.map((r) => r.position!);
    if (input.goalId != null) {
      const goalPositions = openPositioned
        .filter((r) => r.goalId === input.goalId)
        .map((r) => r.position!);
      if (goalPositions.length > 0) {
        position = positionBefore(Math.min(...goalPositions), allPositions);
      }
    } else {
      position = positionBefore(Math.min(...allPositions), allPositions);
    }
  }

  const [inserted] = await db
    .insert(tasks)
    .values({
      title,
      categories: initialCategories,
      pinnedFields: initialPinned,
      goalId: input.goalId ?? null,
      position,
    })
    .returning({ id: tasks.id });

  revalidatePath("/");

  // Fire async triage AFTER the response is sent. Claude is never on the
  // critical render path. If triage fails or no API key, the row stays with
  // null AI fields and the deterministic scorer falls back to defaults.
  after(async () => {
    const result = await triageTask(title);
    if (!result) return;

    const updates: Partial<typeof tasks.$inferInsert> = {
      urgency: result.urgency,
      importance: result.importance,
      estTimeMin: result.est_time_min,
      focus: result.focus,
    };
    // Only overwrite categories if the user did not pick them at creation time.
    if (!userPickedCategories) updates.categories = result.categories;

    await db.update(tasks).set(updates).where(eq(tasks.id, inserted.id));
    revalidatePath("/");
  });
}

export async function updateTaskTitle(id: number, title: string) {
  const trimmed = title.trim();
  if (!trimmed) return;
  await db.update(tasks).set({ title: trimmed }).where(eq(tasks.id, id));
  revalidatePath("/");
}

export async function updateTaskNotes(id: number, notes: string) {
  await db.update(tasks).set({ notes: notes || null }).where(eq(tasks.id, id));
  revalidatePath("/");
}

export async function updateTaskFocus(id: number, focus: "low" | "medium" | "high") {
  await db.update(tasks).set({ focus }).where(eq(tasks.id, id));
  await pinField(id, "focus");
  revalidatePath("/");
}

export async function updateTaskEstTime(id: number, minutes: number) {
  if (!Number.isFinite(minutes) || minutes < 1) return;
  await db.update(tasks).set({ estTimeMin: Math.round(minutes) }).where(eq(tasks.id, id));
  await pinField(id, "estTimeMin");
  revalidatePath("/");
}

export async function setTaskCategories(id: number, categories: string[]) {
  const next = ensureAtLeastOne(categories);
  await db.update(tasks).set({ categories: next }).where(eq(tasks.id, id));
  await pinField(id, "categories");
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
  await pinField(id, "categories");
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
  await pinField(id, "categories");
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

/**
 * Move a task to sit between prevId and nextId (either may be null at a list
 * edge) in the manual order. On the first-ever drag, seed positions for all
 * open tasks from the current scorer order. Inserts between the dragged task's
 * real global neighbors so positions never collide (the prev/next ids are the
 * neighbors in the displayed list, which may be a goal-filtered subset).
 */
export async function moveTask(
  taskId: number,
  prevId: number | null,
  nextId: number | null
) {
  let openTasks = await db.select().from(tasks).where(isNull(tasks.doneAt));
  const seeded = openTasks.some((t) => t.position !== null);

  if (!seeded) {
    const ordered = sortByScore(openTasks, new Date());
    for (let i = 0; i < ordered.length; i++) {
      await db.update(tasks).set({ position: i }).where(eq(tasks.id, ordered[i]!.id));
    }
    openTasks = await db.select().from(tasks).where(isNull(tasks.doneAt));
  }

  const posById = new Map(openTasks.map((t) => [t.id, t.position]));
  const allPositions = openTasks
    .filter((t) => t.id !== taskId && t.position !== null)
    .map((t) => t.position!);

  let newPos: number;
  if (prevId !== null) newPos = positionAfter(posById.get(prevId) ?? null, allPositions);
  else if (nextId !== null) newPos = positionBefore(posById.get(nextId) ?? null, allPositions);
  else newPos = 0;

  await db.update(tasks).set({ position: newPos }).where(eq(tasks.id, taskId));
  revalidatePath("/");
}
