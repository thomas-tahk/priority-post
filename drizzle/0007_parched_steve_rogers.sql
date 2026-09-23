CREATE TABLE "assistant_turns" (
	"id" serial PRIMARY KEY NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
