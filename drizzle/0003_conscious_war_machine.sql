CREATE TABLE "sent_reminders" (
	"id" serial PRIMARY KEY NOT NULL,
	"task_id" integer NOT NULL,
	"kind" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sent_reminders" ADD CONSTRAINT "sent_reminders_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;