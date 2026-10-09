// Validation for goal fields arriving from outside the web UI (the Discord
// assistant, the internal API). Pure: raw values in, a clean patch out, or a
// thrown Error whose message the assistant can read back to the owner.
import { GOAL_COLORS } from "./colors";

export type GoalKind = "gate" | "track";

export type GoalFields = {
  name?: string;
  description?: string | null;
  color?: string;
  kind?: GoalKind;
  targetDate?: string | null; // YYYY-MM-DD
  weeklyTarget?: number | null;
  milestone?: string | null;
};

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/** Only keys present in `raw` appear in the result, so it doubles as a patch.
 *  `null` clears a nullable field; an empty string does too. */
export function parseGoalFields(raw: Record<string, unknown>): GoalFields {
  const out: GoalFields = {};
  if ("name" in raw) out.name = requiredText(raw.name, "name");
  if ("description" in raw) out.description = optionalText(raw.description, "description");
  if ("color" in raw) out.color = oneOf(raw.color, GOAL_COLORS, "color");
  if ("kind" in raw) out.kind = oneOf(raw.kind, ["gate", "track"] as const, "kind");
  if ("targetDate" in raw) out.targetDate = dateKey(raw.targetDate);
  if ("weeklyTarget" in raw) out.weeklyTarget = positiveIntOrNull(raw.weeklyTarget);
  if ("milestone" in raw) out.milestone = optionalText(raw.milestone, "milestone");
  return out;
}

/** A gate is a date someone else set — without the date it is not a gate. */
export function checkShape(goal: { kind: string; targetDate: string | null }): void {
  if (goal.kind === "gate" && goal.targetDate === null) {
    throw new Error("a gate goal needs a targetDate (YYYY-MM-DD)");
  }
}

function requiredText(v: unknown, field: string): string {
  if (typeof v !== "string" || !v.trim()) throw new Error(`${field} must be non-empty text`);
  return v.trim();
}

function optionalText(v: unknown, field: string): string | null {
  if (v === null) return null;
  if (typeof v !== "string") throw new Error(`${field} must be text or null`);
  return v.trim() || null;
}

function oneOf<T extends string>(v: unknown, allowed: readonly T[], field: string): T {
  if (typeof v === "string" && (allowed as readonly string[]).includes(v)) return v as T;
  throw new Error(`${field} must be one of: ${allowed.join(", ")}`);
}

function dateKey(v: unknown): string | null {
  if (v === null) return null;
  if (typeof v === "string" && DATE_KEY.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`))) {
    return v;
  }
  throw new Error("targetDate must be YYYY-MM-DD or null");
}

function positiveIntOrNull(v: unknown): number | null {
  if (v === null) return null;
  if (typeof v === "number" && Number.isInteger(v) && v > 0) return v;
  throw new Error("weeklyTarget must be a positive whole number or null");
}
