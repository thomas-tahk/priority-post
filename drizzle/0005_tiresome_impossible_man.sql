ALTER TABLE "goals" ADD COLUMN "kind" text DEFAULT 'track' NOT NULL;--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "target_date" date;--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "weekly_target" integer;--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "milestone" text;