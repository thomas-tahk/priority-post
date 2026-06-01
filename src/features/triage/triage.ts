// triage.ts is a server-only module by convention (only imported from
// "use server" actions). We rely on Next's environment-variable scoping
// (process.env.ANTHROPIC_API_KEY is never exposed to client bundles) rather
// than the `server-only` package, which throws when imported outside the
// React Server Components environment and breaks tsx + vitest.
import Anthropic from "@anthropic-ai/sdk";
import { CATEGORIES, type Category } from "@/features/tasks/categories";
import { notesToPlainText } from "@/lib/notes";

const FOCUS_VALUES = ["low", "medium", "high"] as const;
export type Focus = (typeof FOCUS_VALUES)[number];

export type TriageResult = {
  categories: Category[];
  urgency: number;
  importance: number;
  est_time_min: number;
  focus: Focus;
};

const SYSTEM_PROMPT = `You are a task triage assistant for a personal smart to-do app.

The user enters a task in natural language. You infer five fields:

1. categories: 1-3 from this set: ${CATEGORIES.join(", ")}.
   - work: paid/professional work
   - personal: errands and obligations not work-related
   - health: exercise, medical, sleep, mental health
   - learning: study, reading, courses, deliberate practice
   - errands: short trips and chores (groceries, pickup/dropoff)
   - side_project: hobby coding, creative side work, indie projects
   - other: only if nothing else fits
   Use multiple when a task spans clearly different categories (e.g. "buy mom's birthday gift" → personal, errands).

2. urgency (0-100): time pressure. Past-due / due-today = 90+. Due this week = 60-80. Vague but soon = 40-60. No deadline = 20-40.

3. importance (0-100): impact on goals. Mission-critical work = 80+. Routine but matters = 50-70. Nice-to-have = 20-40.

4. est_time_min: realistic estimate in minutes. 5-15 for a quick errand, 15-60 for focused work, 60-180 for deep work, 180+ for big projects. Never zero.

5. focus: cognitive load required. "high" for deep technical work, writing, learning. "medium" for code review, planning, meetings. "low" for errands, admin, chores.

Be decisive. Pick concrete numbers, not round-number defaults. Never refuse — pick the best inference.`;

const TOOL_NAME = "record_triage";

const TRIAGE_TOOL: Anthropic.Tool = {
  name: TOOL_NAME,
  description: "Record the inferred fields for the task.",
  input_schema: {
    type: "object",
    properties: {
      categories: {
        type: "array",
        items: { type: "string", enum: [...CATEGORIES] },
        minItems: 1,
        maxItems: 3,
      },
      urgency: { type: "integer", minimum: 0, maximum: 100 },
      importance: { type: "integer", minimum: 0, maximum: 100 },
      est_time_min: { type: "integer", minimum: 1 },
      focus: { type: "string", enum: [...FOCUS_VALUES] },
    },
    required: ["categories", "urgency", "importance", "est_time_min", "focus"],
    additionalProperties: false,
  },
};

export type TriageDeps = {
  client?: Anthropic;
  apiKey?: string;
};

function isCategory(s: unknown): s is Category {
  return typeof s === "string" && (CATEGORIES as readonly string[]).includes(s);
}

function isFocus(s: unknown): s is Focus {
  return typeof s === "string" && (FOCUS_VALUES as readonly string[]).includes(s);
}

function validate(input: unknown): TriageResult | null {
  if (typeof input !== "object" || input === null) return null;
  const i = input as Record<string, unknown>;

  if (!Array.isArray(i.categories)) return null;
  const categories = i.categories.filter(isCategory);
  if (categories.length === 0) return null;

  if (typeof i.urgency !== "number" || i.urgency < 0 || i.urgency > 100) return null;
  if (typeof i.importance !== "number" || i.importance < 0 || i.importance > 100) return null;
  if (typeof i.est_time_min !== "number" || i.est_time_min < 1) return null;
  if (!isFocus(i.focus)) return null;

  return {
    categories,
    urgency: Math.round(i.urgency),
    importance: Math.round(i.importance),
    est_time_min: Math.round(i.est_time_min),
    focus: i.focus,
  };
}

export async function triageTask(
  title: string,
  notes: string | null = null,
  deps: TriageDeps = {}
): Promise<TriageResult | null> {
  const apiKey = deps.apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey && !deps.client) {
    console.warn("ANTHROPIC_API_KEY not set — skipping triage.");
    return null;
  }

  const client = deps.client ?? new Anthropic({ apiKey });
  const plainNotes = notesToPlainText(notes);
  const userContent = plainNotes ? `Title: ${title}\nNotes: ${plainNotes}` : title;

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: [TRIAGE_TOOL],
      tool_choice: { type: "tool", name: TOOL_NAME },
      messages: [{ role: "user", content: userContent }],
    });

    for (const block of response.content) {
      if (block.type === "tool_use" && block.name === TOOL_NAME) {
        return validate(block.input);
      }
    }
    return null;
  } catch (e) {
    if (e instanceof Anthropic.APIError) {
      console.error(`Triage API error ${e.status}:`, e.message);
    } else {
      console.error("Triage failed:", e);
    }
    return null;
  }
}
