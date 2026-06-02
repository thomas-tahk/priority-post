import { describe, it, expect } from "vitest";
import { validateDisposition, type Disposition } from "./disposition";

describe("validateDisposition", () => {
  it("accepts unassign", () => {
    const d: Disposition = { kind: "unassign" };
    expect(validateDisposition(d, 5)).toEqual(d);
  });

  it("accepts delete", () => {
    const d: Disposition = { kind: "delete" };
    expect(validateDisposition(d, 5)).toEqual(d);
  });

  it("accepts reassign to a different goal", () => {
    const d: Disposition = { kind: "reassign", targetGoalId: 7 };
    expect(validateDisposition(d, 5)).toEqual(d);
  });

  it("rejects reassign to the goal being deleted", () => {
    const d: Disposition = { kind: "reassign", targetGoalId: 5 };
    expect(() => validateDisposition(d, 5)).toThrow(/itself/);
  });
});
