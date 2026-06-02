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
