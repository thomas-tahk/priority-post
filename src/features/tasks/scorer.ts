import type { Task } from "@/db/schema";

/**
 * Deterministic scorer (pure functions, no DB, no clock reads).
 *
 * score = w_urgency * urgencyPressure
 *       + w_importance * importanceNorm
 *       + w_fit * fitNow
 *
 * Inputs: urgency 0-100, importance 0-100, focus low|medium|high, optional start_at.
 * Defaults are used when AI fields are null (pre-triage), so the list always sorts.
 */

export const WEIGHTS = {
  urgency: 0.5,
  importance: 0.35,
  fit: 0.15,
} as const;

export const DEFAULTS = {
  urgency: 30,
  importance: 40,
} as const;

export type Focus = "low" | "medium" | "high";
export type TimeOfDay = "morning" | "midday" | "afternoon" | "evening" | "night";

export function timeOfDay(now: Date): TimeOfDay {
  const h = now.getHours();
  if (h >= 5 && h < 11) return "morning";
  if (h >= 11 && h < 14) return "midday";
  if (h >= 14 && h < 18) return "afternoon";
  if (h >= 18 && h < 22) return "evening";
  return "night";
}

const FIT_TABLE: Record<TimeOfDay, Record<Focus, number>> = {
  morning: { high: 1.0, medium: 0.7, low: 0.4 },
  midday: { high: 0.85, medium: 0.9, low: 0.6 },
  afternoon: { high: 0.6, medium: 0.85, low: 0.7 },
  evening: { high: 0.4, medium: 0.7, low: 1.0 },
  night: { high: 0.25, medium: 0.5, low: 0.9 },
};

export function fitNow(focus: string | null | undefined, now: Date): number {
  if (focus !== "low" && focus !== "medium" && focus !== "high") return 0.5;
  return FIT_TABLE[timeOfDay(now)][focus];
}

export function importanceNorm(importance: number | null | undefined): number {
  const v = importance ?? DEFAULTS.importance;
  return clamp01(v / 100);
}

export function urgencyPressure(
  now: Date,
  urgency: number | null | undefined,
  startAt: Date | null | undefined
): number {
  const base = clamp01((urgency ?? DEFAULTS.urgency) / 100);
  if (!startAt) return base;

  const hoursUntil = (startAt.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (hoursUntil <= 0) return 1.0; // overdue or due now
  if (hoursUntil < 24) {
    // Ramp from ~1 (just-soon) down to ~0.2 at 24h out.
    const ramp = 1 - hoursUntil / 30;
    return clamp01(Math.max(base, ramp));
  }
  if (hoursUntil < 168) {
    // 1–7 days: gentle decay from ~0.5 to ~0.02
    const ramp = 0.5 - (hoursUntil - 24) / 300;
    return clamp01(Math.max(base, ramp));
  }
  return base;
}

export function score(task: TaskForScoring, now: Date): number {
  const u = urgencyPressure(now, task.urgency, task.startAt);
  const i = importanceNorm(task.importance);
  const f = fitNow(task.focus, now);
  return WEIGHTS.urgency * u + WEIGHTS.importance * i + WEIGHTS.fit * f;
}

export type TaskForScoring = Pick<
  Task,
  "urgency" | "importance" | "focus" | "startAt" | "createdAt"
>;

export function sortByScore<T extends TaskForScoring>(items: T[], now: Date): T[] {
  return [...items]
    .map((t) => ({ t, s: score(t, now) }))
    .sort((a, b) => {
      if (b.s !== a.s) return b.s - a.s;
      // tie-break: older createdAt first
      return a.t.createdAt.getTime() - b.t.createdAt.getTime();
    })
    .map((x) => x.t);
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}
