export type ActivityEntry = { actor: string; summary: string };

export type ParsedActivity = { ok: true; entry: ActivityEntry } | { ok: false; reason: string };

// One digest line. Longer than this is working output the lead should have
// filtered before writing — refusing it keeps that filter honest.
const MAX_SUMMARY = 500;

/** Validates a POST body for the activity feed. */
export function parseActivity(body: unknown): ParsedActivity {
  if (typeof body !== "object" || body === null) return { ok: false, reason: "body must be an object" };
  const { actor, summary } = body as Record<string, unknown>;
  const a = typeof actor === "string" ? actor.trim() : "";
  const s = typeof summary === "string" ? summary.trim() : "";
  if (!a) return { ok: false, reason: "actor is required" };
  if (!s) return { ok: false, reason: "summary is required" };
  if (s.length > MAX_SUMMARY) return { ok: false, reason: `summary is over ${MAX_SUMMARY} characters` };
  return { ok: true, entry: { actor: a, summary: s } };
}
