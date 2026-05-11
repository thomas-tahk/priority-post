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

function isPinned(task: Task, field: string): boolean {
  const pf = task.pinnedFields;
  if (Array.isArray(pf)) return pf.includes(field);
  return false;
}

function Sparkle({ field }: { field: string }) {
  return (
    <span
      className="sparkle"
      title={`AI inferred (${field}). Click to edit and pin your value.`}
    >
      ✨
    </span>
  );
}

function formatTime(min: number): string {
  if (min >= 60) {
    const h = min / 60;
    const display = min % 60 === 0 ? h.toFixed(0) : h.toFixed(1);
    return `${display}h`;
  }
  return `${min}m`;
}

export function TaskRow({ task, isTop = false }: { task: Task; isTop?: boolean }) {
  const [, startTransition] = useTransition();
  const [picking, setPicking] = useState(false);
  const [title, setTitle] = useState(task.title);
  const done = task.doneAt !== null;

  const showSparkle = (field: string) => !isPinned(task, field);

  function commitTitle() {
    if (title.trim() === task.title) return;
    if (!title.trim()) {
      setTitle(task.title);
      return;
    }
    startTransition(() => updateTaskTitle(task.id, title));
  }

  const showMetaPills =
    task.estTimeMin !== null || task.focus !== null;

  return (
    <div className={`task ${isTop ? "top" : ""} ${done ? "done" : ""}`}>
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
        {task.categories.length > 0 && showSparkle("categories") && task.urgency !== null && (
          <Sparkle field="categories" />
        )}
        <button
          type="button"
          className="pill add-tag"
          onClick={() => setPicking((p) => !p)}
        >
          + tag
        </button>
        {task.estTimeMin !== null && (
          <span className="pill">
            ~{formatTime(task.estTimeMin)}
            {showSparkle("estTimeMin") && <Sparkle field="estTimeMin" />}
          </span>
        )}
        {task.focus && (
          <span className="pill">
            {task.focus} focus
            {showSparkle("focus") && <Sparkle field="focus" />}
          </span>
        )}
        {!showMetaPills && task.urgency === null && (
          <span className="pill" style={{ opacity: 0.5, fontStyle: "italic" }}>
            awaiting triage
          </span>
        )}
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
