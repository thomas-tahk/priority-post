"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { Goal } from "@/db/schema";
import { updateGoal } from "./actions";
import { GOAL_COLORS, CAT_COLOR_VAR } from "./colors";

export function GoalSettingsMenu({ goal, onDelete }: { goal: Goal; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(goal.name);
  const [, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function commitName() {
    setRenaming(false);
    if (name.trim() && name.trim() !== goal.name) {
      startTransition(() => updateGoal(goal.id, { name }));
    } else {
      setName(goal.name);
    }
  }

  return (
    <div className="menu-wrap" ref={ref}>
      <button type="button" className="btn ghost" style={{ fontSize: 18 }} onClick={() => setOpen((o) => !o)}>⋯</button>
      {open && (
        <div className="menu">
          {renaming ? (
            <input
              className="menu-rename"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
            />
          ) : (
            <button type="button" onClick={() => setRenaming(true)}>Rename goal</button>
          )}
          <div className="menu-colors">
            {GOAL_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={`menu-swatch${goal.color === c ? " sel" : ""}`}
                style={{ background: CAT_COLOR_VAR(c) }}
                aria-label={`Color ${c}`}
                onClick={() => startTransition(() => updateGoal(goal.id, { color: c }))}
              />
            ))}
          </div>
          <div className="sep" />
          <button type="button" className="danger" onClick={() => { setOpen(false); onDelete(); }}>Delete goal…</button>
        </div>
      )}
    </div>
  );
}
