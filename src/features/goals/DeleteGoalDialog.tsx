"use client";

import { useState, useTransition } from "react";
import type { Goal } from "@/db/schema";
import { deleteGoal } from "./actions";
import type { Disposition } from "./disposition";

type Choice = "unassign" | "reassign" | "delete";

export function DeleteGoalDialog({
  goal,
  taskCount,
  otherGoals,
  onClose,
  onDeleted,
}: {
  goal: Goal;
  taskCount: number;
  otherGoals: Goal[];
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [choice, setChoice] = useState<Choice>("unassign");
  const [targetGoalId, setTargetGoalId] = useState<number | null>(otherGoals[0]?.id ?? null);
  const [isPending, startTransition] = useTransition();

  function confirm() {
    let disposition: Disposition;
    if (choice === "reassign") {
      if (targetGoalId === null) return;
      disposition = { kind: "reassign", targetGoalId };
    } else {
      disposition = { kind: choice };
    }
    startTransition(async () => {
      await deleteGoal(goal.id, disposition);
      onDeleted();
      onClose();
    });
  }

  return (
    <div className="scrim open" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <h3>Delete "{goal.name}"?</h3>
        <p>This goal has <strong>{taskCount} task{taskCount === 1 ? "" : "s"}</strong>. Choose what happens to them:</p>
        <div className="disposition">
          <label className={`disp-opt${choice === "unassign" ? " sel" : ""}`}>
            <input type="radio" name="disp" checked={choice === "unassign"} onChange={() => setChoice("unassign")} />
            <span>Move them to Overview (no goal)</span>
          </label>
          <label className={`disp-opt${choice === "reassign" ? " sel" : ""}`} style={{ opacity: otherGoals.length ? 1 : 0.5 }}>
            <input type="radio" name="disp" disabled={!otherGoals.length} checked={choice === "reassign"} onChange={() => setChoice("reassign")} />
            <span>Move them to another goal</span>
            <select
              value={targetGoalId ?? ""}
              disabled={!otherGoals.length || choice !== "reassign"}
              onChange={(e) => setTargetGoalId(Number(e.target.value))}
            >
              {otherGoals.map((g) => (<option key={g.id} value={g.id}>{g.name}</option>))}
            </select>
          </label>
          <label className={`disp-opt${choice === "delete" ? " sel" : ""}`}>
            <input type="radio" name="disp" checked={choice === "delete"} onChange={() => setChoice("delete")} />
            <span>Delete the tasks too</span>
          </label>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="btn danger" disabled={isPending} onClick={confirm}>Delete goal</button>
        </div>
      </div>
    </div>
  );
}
