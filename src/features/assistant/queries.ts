import { asc, desc } from "drizzle-orm";
import type Anthropic from "@anthropic-ai/sdk";
import { db } from "@/db";
import { assistantTurns } from "@/db/schema";

// How many stored turns to hand the model. trimHistory caps the list again on
// the way in; this cap is about how much of the table we bother reading.
const WINDOW = 16;

/** The recent conversation, oldest first, in the shape the agent expects. */
export async function loadTurns(): Promise<Anthropic.MessageParam[]> {
  const rows = await db
    .select({ role: assistantTurns.role, content: assistantTurns.content })
    .from(assistantTurns)
    .orderBy(desc(assistantTurns.id))
    .limit(WINDOW);

  return rows
    .reverse()
    .map((r) => ({ role: r.role === "assistant" ? "assistant" : "user", content: r.content }));
}

/** Append one exchange. Written after the reply is known so a crashed run
 * leaves no half-conversation the next turn would have to reason around. */
export async function appendExchange(userText: string, replyText: string): Promise<void> {
  await db.insert(assistantTurns).values([
    { role: "user", content: userText },
    { role: "assistant", content: replyText },
  ]);
}

/** Drop the stored conversation. Backs the `/pp reset` escape hatch — a wedged
 * history is otherwise unfixable from a phone. */
export async function clearTurns(): Promise<number> {
  const deleted = await db.delete(assistantTurns).returning({ id: assistantTurns.id });
  return deleted.length;
}

/** Oldest-first read used only by tests that assert ordering. */
export async function allTurns() {
  return db.select().from(assistantTurns).orderBy(asc(assistantTurns.id));
}
