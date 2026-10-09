"use client";

import { useTransition } from "react";
import type { Task } from "@/db/schema";
import { shortDate } from "@/features/goals/history";
import { deleteTask } from "./actions";

/** True when the TipTap HTML holds any text — `<p></p>` counts as empty. */
function hasNotes(notes: string | null): boolean {
  return (notes ?? "").replace(/<[^>]*>/g, "").trim().length > 0;
}

/** A closed task: readable at a glance, opens the closed detail panel. */
export function DoneRow({
  task,
  timezone,
  onOpen,
}: {
  task: Task;
  timezone: string;
  onOpen: (t: Task) => void;
}) {
  const [, startTransition] = useTransition();

  return (
    <div className="done-row" data-detail-opener onClick={() => onOpen(task)}>
      <span className="done-tick" aria-label="Done">✓</span>
      <span className="done-cat" style={{ background: `var(--cat-${task.categories[0] ?? "other"})` }} />
      <span className="done-title">{task.title}</span>
      {hasNotes(task.notes) && <span className="done-notes" title="Has notes">✎</span>}
      <span className="done-when">{shortDate(task.doneAt!, timezone)}</span>
      <button
        type="button"
        className="icon-btn"
        aria-label="Delete task"
        onClick={(e) => {
          e.stopPropagation();
          if (confirm("Delete this task?")) startTransition(() => deleteTask(task.id));
        }}
      >
        ✕
      </button>
    </div>
  );
}
