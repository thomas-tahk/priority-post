import { pgTable, serial, text, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const goals = pgTable("goals", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  color: text("color").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  doneAt: timestamp("done_at", { withTimezone: true }),
  startAt: timestamp("start_at", { withTimezone: true }),
  categories: text("categories").array().notNull().default(sql`ARRAY['other']::text[]`),
  urgency: integer("urgency"),
  importance: integer("importance"),
  estTimeMin: integer("est_time_min"),
  focus: text("focus"),
  pinnedFields: jsonb("pinned_fields").notNull().default(sql`'[]'::jsonb`),
  goalId: integer("goal_id").references(() => goals.id, { onDelete: "set null" }),
});

export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type Goal = typeof goals.$inferSelect;
export type NewGoal = typeof goals.$inferInsert;
