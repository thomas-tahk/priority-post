import { db } from "@/db";
import { goals, type Goal } from "@/db/schema";
import { asc } from "drizzle-orm";

export async function listGoals(): Promise<Goal[]> {
  return db.select().from(goals).orderBy(asc(goals.createdAt));
}
