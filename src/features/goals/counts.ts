// Pure helpers over task rows. The callers pass only the fields used here, so
// these stay decoupled from the full Task type and trivially testable.

export function openCountByGoal(
  tasks: { goalId: number | null; doneAt: Date | null }[]
): Record<number, number> {
  const counts: Record<number, number> = {};
  for (const t of tasks) {
    if (t.goalId === null || t.doneAt !== null) continue;
    counts[t.goalId] = (counts[t.goalId] ?? 0) + 1;
  }
  return counts;
}

export function goalStats(
  tasks: { doneAt: Date | null }[]
): { total: number; done: number } {
  let done = 0;
  for (const t of tasks) if (t.doneAt !== null) done++;
  return { total: tasks.length, done };
}
