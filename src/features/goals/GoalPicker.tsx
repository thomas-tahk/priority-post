"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { Goal } from "@/db/schema";
import { assignTaskGoal } from "./actions";
import { CAT_COLOR_VAR } from "./colors";

export function GoalPicker({
  taskId,
  goals,
  currentGoalId,
}: {
  taskId: number;
  goals: Goal[];
  currentGoalId: number | null;
}) {
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement | null>(null);
  const current = goals.find((g) => g.id === currentGoalId) ?? null;

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function pick(goalId: number | null) {
    setOpen(false);
    startTransition(() => assignTaskGoal(taskId, goalId));
  }

  return (
    <div className="goal-field menu-wrap" ref={ref}>
      <button type="button" className="goal-select" onClick={() => setOpen((o) => !o)}>
        {current ? (
          <>
            <span className="dot" style={{ background: CAT_COLOR_VAR(current.color) }} />
            <span>{current.name}</span>
          </>
        ) : (
          <span className="dim">No goal</span>
        )}
      </button>
      {open && (
        <div className="pop">
          <button type="button" onClick={() => pick(null)}>
            <span className="dot" style={{ background: "var(--text-faint)" }} />No goal
          </button>
          {goals.map((g) => (
            <button type="button" key={g.id} onClick={() => pick(g.id)}>
              <span className="dot" style={{ background: CAT_COLOR_VAR(g.color) }} />{g.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
