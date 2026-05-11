CREATE TABLE "tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"done_at" timestamp with time zone,
	"start_at" timestamp with time zone,
	"categories" text[] DEFAULT ARRAY['other']::text[] NOT NULL,
	"urgency" integer,
	"importance" integer,
	"est_time_min" integer,
	"focus" text,
	"pinned_fields" jsonb DEFAULT '[]'::jsonb NOT NULL
);
