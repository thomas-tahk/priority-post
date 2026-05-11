"use client";

import { useState, useTransition } from "react";
import { type Task } from "@/db/schema";
import { CATEGORY_LABELS, type Category } from "./categories";
import {
  toggleTaskDone,
  deleteTask,
  updateTaskTitle,
  addTaskCategory,
  removeTaskCategory,
} from "./actions";
import { TagPicker } from "./TagPicker";

export function TaskRow({ task }: { task: Task }) {
  const [, startTransition] = useTransition();
  const [picking, setPicking] = useState(false);
  const [title, setTitle] = useState(task.title);
  const done = task.doneAt !== null;

  function commitTitle() {
    if (title.trim() === task.title) return;
    if (!title.trim()) {
      setTitle(task.title);
      return;
    }
    startTransition(() => updateTaskTitle(task.id, title));
  }

  return (
    <div className={`task ${done ? "done" : ""}`}>
      <div className="title-row">
        <button
          type="button"
          className="checkbox"
          aria-label={done ? "Mark as not done" : "Mark as done"}
          onClick={() => startTransition(() => toggleTaskDone(task.id, !done))}
        />
        <input
          className="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={commitTitle}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "Escape") {
              setTitle(task.title);
              (e.target as HTMLInputElement).blur();
            }
          }}
        />
        <div className="row-actions">
          <button
            type="button"
            className="icon-btn"
            aria-label="Delete task"
            onClick={() => {
              if (confirm("Delete this task?")) {
                startTransition(() => deleteTask(task.id));
              }
            }}
          >
            ✕
          </button>
        </div>
      </div>
      <div className="meta">
        {task.categories.map((cat) => (
          <span key={cat} className="pill cat" data-cat={cat}>
            {CATEGORY_LABELS[cat as Category] ?? cat}
            <button
              type="button"
              className="chip-x"
              aria-label={`Remove ${cat}`}
              onClick={() =>
                startTransition(() => removeTaskCategory(task.id, cat as Category))
              }
            >
              ×
            </button>
          </span>
        ))}
        <button
          type="button"
          className="pill add-tag"
          onClick={() => setPicking((p) => !p)}
        >
          + tag
        </button>
        {picking && (
          <TagPicker
            current={task.categories}
            onPick={(cat) => {
              startTransition(() => addTaskCategory(task.id, cat));
              setPicking(false);
            }}
            onClose={() => setPicking(false)}
          />
        )}
      </div>
    </div>
  );
}
