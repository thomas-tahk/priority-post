"use client";

import { useState, useTransition } from "react";
import type { Task, Goal } from "@/db/schema";
import type { ScoredTask } from "@/features/constellation/layout";
import { TaskRow } from "@/features/tasks/TaskRow";
import { SortableTaskList } from "@/features/tasks/SortableTaskList";
import { AddTaskBar } from "@/features/tasks/AddTaskBar";
import { goalStats } from "./counts";
import { startedAgo } from "./dates";
import { updateGoal } from "./actions";
import { GoalSettingsMenu } from "./GoalSettingsMenu";
import { DeleteGoalDialog } from "./DeleteGoalDialog";

export function GoalPage({
  goal,
  open,
  done,
  goals,
  onSelectTask,
  onDeleted,
}: {
  goal: Goal;
  open: ScoredTask[];
  done: Task[];
  goals: Goal[];
  onSelectTask: (t: Task) => void;
  onDeleted: () => void;
}) {
  const [, startTransition] = useTransition();
  const [editingDesc, setEditingDesc] = useState(false);
  const [desc, setDesc] = useState(goal.description ?? "");
  const [deleteOpen, setDeleteOpen] = useState(false);

  const stats = goalStats([...open, ...done]);

  function commitDesc() {
    setEditingDesc(false);
    if ((goal.description ?? "") === desc.trim()) return;
    startTransition(() => updateGoal(goal.id, { description: desc }));
  }

  return (
    <div className="pane">
      <div className="ctx-head">
        <div>
          <h2>{goal.name}</h2>
          <div className="meta">
            {stats.total} tasks · {stats.done} done · started {startedAgo(new Date(goal.createdAt), new Date())}
          </div>
        </div>
        <GoalSettingsMenu goal={goal} onDelete={() => setDeleteOpen(true)} />
      </div>

      {editingDesc ? (
        <textarea
          className="goal-desc-edit"
          autoFocus
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          onBlur={commitDesc}
          placeholder="What does done look like?"
        />
      ) : (
        <div className="goal-desc" onClick={() => setEditingDesc(true)}>
          {goal.description || <span className="dim">Add a description…</span>}
        </div>
      )}

      <AddTaskBar goalId={goal.id} placeholder="add a task to this goal…" hint={`⏎ — assigned to ${goal.name}`} />

      <p className="section-label">
        {open.length === 0
          ? "no open tasks"
          : `${open.length} open · ${
              open.some((t) => t.position !== null) ? "your order" : "ranked"
            }`}
      </p>
      {open.length > 0 && <SortableTaskList tasks={open} onOpen={onSelectTask} />}

      {done.length > 0 && (
        <>
          <p className="section-label" style={{ marginTop: 28 }}>done · {done.length}</p>
          {done.map((t) => (<TaskRow key={t.id} task={t} />))}
        </>
      )}

      {deleteOpen && (
        <DeleteGoalDialog
          goal={goal}
          taskCount={stats.total}
          otherGoals={goals.filter((g) => g.id !== goal.id)}
          onClose={() => setDeleteOpen(false)}
          onDeleted={onDeleted}
        />
      )}
    </div>
  );
}
