import { db } from "@/db";
import { tasks, type Task } from "@/db/schema";
import { desc } from "drizzle-orm";

export async function listTasks(): Promise<Task[]> {
  return db.select().from(tasks).orderBy(desc(tasks.createdAt));
}
