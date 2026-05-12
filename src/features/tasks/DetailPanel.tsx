"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { Task } from "@/db/schema";
import { CATEGORY_LABELS, type Category } from "./categories";
import {
  addTaskCategory,
  removeTaskCategory,
  updateTaskEstTime,
  updateTaskFocus,
  updateTaskNotes,
  updateTaskTitle,
} from "./actions";
import { TagPicker } from "./TagPicker";

const NOTES_DEBOUNCE_MS = 600;
const FOCUS_VALUES = ["low", "medium", "high"] as const;

function isPinned(task: Task, field: string): boolean {
  const pf = task.pinnedFields;
  return Array.isArray(pf) && pf.includes(field);
}

function Sparkle({ field }: { field: string }) {
  return (
    <span className="sparkle" title={`AI inferred (${field}). Click to edit and pin.`}>
      ✨
    </span>
  );
}

function parseEstTime(value: string): number | null {
  const m = value.trim().match(/^(\d+(?:\.\d+)?)\s*(h|m)?$/i);
  if (!m) return null;
  const n = parseFloat(m[1]!);
  return m[2]?.toLowerCase() === "h" ? Math.round(n * 60) : Math.round(n);
}

function formatEstTime(min: number | null): string {
  if (min === null) return "";
  if (min >= 60) {
    const h = min / 60;
    return min % 60 === 0 ? `${h.toFixed(0)}h` : `${h.toFixed(1)}h`;
  }
  return `${min}m`;
}

export function DetailPanel({
  task,
  onClose,
}: {
  task: Task | null;
  onClose: () => void;
}) {
  const [, startTransition] = useTransition();
  const [picking, setPicking] = useState(false);
  const [title, setTitle] = useState(task?.title ?? "");
  const [notes, setNotes] = useState(task?.notes ?? "");
  const [estTime, setEstTime] = useState(formatEstTime(task?.estTimeMin ?? null));
  const panelRef = useRef<HTMLDivElement | null>(null);
  const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset local state when a different task is opened.
  useEffect(() => {
    setTitle(task?.title ?? "");
    setNotes(task?.notes ?? "");
    setEstTime(formatEstTime(task?.estTimeMin ?? null));
    setPicking(false);
  }, [task?.id, task?.title, task?.notes, task?.estTimeMin]);

  // Click-outside-closes.
  useEffect(() => {
    if (!task) return;
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        // Bubble click events on the SVG and list rows would re-open immediately;
        // ignore clicks on elements explicitly marked as opener.
        const opener = (e.target as HTMLElement).closest("[data-detail-opener]");
        if (opener) return;
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [task, onClose]);

  // Escape to close.
  useEffect(() => {
    if (!task) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [task, onClose]);

  if (!task) return <aside className="panel" aria-hidden="true" />;

  function commitTitle() {
    const trimmed = title.trim();
    if (!trimmed || !task || trimmed === task.title) return;
    startTransition(() => updateTaskTitle(task.id, trimmed));
  }

  function scheduleNotesSave(value: string) {
    setNotes(value);
    if (notesTimer.current) clearTimeout(notesTimer.current);
    if (!task) return;
    const id = task.id;
    notesTimer.current = setTimeout(() => {
      startTransition(() => updateTaskNotes(id, value));
    }, NOTES_DEBOUNCE_MS);
  }

  function commitEstTime() {
    if (!task) return;
    const parsed = parseEstTime(estTime);
    if (parsed === null) {
      setEstTime(formatEstTime(task.estTimeMin));
      return;
    }
    if (parsed === task.estTimeMin) return;
    startTransition(() => updateTaskEstTime(task.id, parsed));
  }

  function showSparkle(field: string) {
    return !isPinned(task!, field);
  }

  return (
    <aside className="panel open" ref={panelRef}>
      <button type="button" className="close" aria-label="Close panel" onClick={onClose}>
        ×
      </button>

      <input
        className="editable-title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={commitTitle}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
      />

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 6,
          alignItems: "center",
          marginTop: 8,
          position: "relative",
        }}
      >
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
        {showSparkle("categories") && task.urgency !== null && (
          <Sparkle field="categories" />
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

      <div className="field-block">
        <label className="field-label">Notes</label>
        <textarea
          className="notes-textarea"
          placeholder="Add notes, links, or context…"
          value={notes}
          onChange={(e) => scheduleNotesSave(e.target.value)}
          onBlur={() => {
            if (notesTimer.current) clearTimeout(notesTimer.current);
            startTransition(() => updateTaskNotes(task.id, notes));
          }}
        />
      </div>

      <div className="field-block">
        <dl className="field-grid">
          <dt>Est. time</dt>
          <dd>
            <input
              type="text"
              value={estTime}
              onChange={(e) => setEstTime(e.target.value)}
              onBlur={commitEstTime}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
              style={{ width: 80 }}
              placeholder="e.g. 30m or 1h"
            />
            {task.estTimeMin !== null && showSparkle("estTimeMin") && (
              <Sparkle field="estTimeMin" />
            )}
          </dd>
          <dt>Focus</dt>
          <dd>
            <select
              value={task.focus ?? ""}
              onChange={(e) =>
                startTransition(() =>
                  updateTaskFocus(task.id, e.target.value as "low" | "medium" | "high")
                )
              }
            >
              <option value="" disabled>
                —
              </option>
              {FOCUS_VALUES.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
            {task.focus !== null && showSparkle("focus") && <Sparkle field="focus" />}
          </dd>
        </dl>
      </div>
    </aside>
  );
}
