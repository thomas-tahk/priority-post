CREATE TABLE "activity" (
	"id" serial PRIMARY KEY NOT NULL,
	"actor" text NOT NULL,
	"summary" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
