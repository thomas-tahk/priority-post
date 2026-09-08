import { pgTable, serial, text, timestamp, integer, jsonb, doublePrecision } from "drizzle-orm/pg-core";
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
  position: doublePrecision("position"),
});

// Phase 3: dedup log for the Discord bot's due-soon / overdue pings. Each
// (task, kind) is recorded once so a scheduled tick never re-pings the same
// event. Lives in Postgres (not bot memory) so the bot is restart-safe.
export const sentReminders = pgTable("sent_reminders", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(), // 'due_soon' | 'overdue'
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
});

// One row per day the evening digest actually went out, keyed by the calendar
// day in the user's zone. The hourly tick reads this to answer "is today's
// digest owed?" — which is what lets a skipped tick fire late instead of never.
export const sentDigests = pgTable("sent_digests", {
  day: text("day").primaryKey(),
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type Goal = typeof goals.$inferSelect;
export type NewGoal = typeof goals.$inferInsert;
export type SentReminder = typeof sentReminders.$inferSelect;
export type SentDigest = typeof sentDigests.$inferSelect;
