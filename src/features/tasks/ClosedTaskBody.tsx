"use client";

import { useTransition } from "react";
import type { Task, Goal } from "@/db/schema";
import { CAT_COLOR_VAR } from "@/features/goals/colors";
import { daysOpen, shortDate } from "@/features/goals/history";
import { CATEGORY_LABELS, type Category } from "./categories";
import { toggleTaskDone } from "./actions";
import { NotesEditor } from "./NotesEditor";

/** Detail panel contents for a done task. Closed means read-only — except notes,
 *  which stay open for writing down what happened. Reopen to edit the rest. */
export function ClosedTaskBody({ task, goals, timezone }: { task: Task; goals: Goal[]; timezone: string }) {
  const [, startTransition] = useTransition();
  const goal = goals.find((g) => g.id === task.goalId) ?? null;
  const open = daysOpen(task, timezone);

  return (
    <>
      <div className="closed-banner">
        <span className="closed-tick">✓</span>
        <div className="closed-text">
          <b>Closed {shortDate(task.doneAt!, timezone)}</b>
          <span>
            open {open === 0 ? "under a day" : `${open}d`} · created {shortDate(task.createdAt, timezone)}
          </span>
        </div>
        <button type="button" className="btn" onClick={() => startTransition(() => toggleTaskDone(task.id, false))}>
          Reopen
        </button>
      </div>

      <h2 className="closed-title">{task.title}</h2>
      <div className="closed-cats">
        {task.categories.map((cat) => (
          <span key={cat} className="pill cat" data-cat={cat}>{CATEGORY_LABELS[cat as Category] ?? cat}</span>
        ))}
      </div>

      <dl className="field-grid closed-fields">
        <dt>Goal</dt>
        <dd>
          {goal ? (
            <><span className="dot" style={{ background: CAT_COLOR_VAR(goal.color) }} /> {goal.name}</>
          ) : "—"}
        </dd>
        <dt>Est. time</dt>
        <dd>{task.estTimeMin !== null ? `${task.estTimeMin}m` : "—"}</dd>
        <dt>Focus</dt>
        <dd>{task.focus ?? "—"}</dd>
      </dl>

      <div className="field-block">
        <label className="field-label">Notes</label>
        <NotesEditor taskId={task.id} initialContent={task.notes ?? ""} />
      </div>
    </>
  );
}
