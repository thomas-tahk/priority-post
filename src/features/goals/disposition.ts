// What happens to a goal's tasks when the goal is deleted.
export type Disposition =
  | { kind: "unassign" }                       // tasks -> no goal (Overview)
  | { kind: "reassign"; targetGoalId: number } // tasks -> another goal
  | { kind: "delete" };                        // tasks deleted too

export function validateDisposition(d: Disposition, deletingGoalId: number): Disposition {
  if (d.kind === "reassign" && d.targetGoalId === deletingGoalId) {
    throw new Error("Cannot reassign a goal's tasks to itself.");
  }
  return d;
}

/** A disposition from untrusted JSON (the internal API, the Discord assistant). */
export function parseDisposition(raw: unknown): Disposition {
  const r = (raw ?? {}) as { kind?: unknown; targetGoalId?: unknown };
  if (r.kind === "unassign" || r.kind === "delete") return { kind: r.kind };
  if (r.kind === "reassign") {
    if (typeof r.targetGoalId === "number" && Number.isInteger(r.targetGoalId)) {
      return { kind: "reassign", targetGoalId: r.targetGoalId };
    }
    throw new Error("reassign needs a targetGoalId (the goal that takes the tasks)");
  }
  throw new Error("disposition kind must be one of: unassign, reassign, delete");
}
