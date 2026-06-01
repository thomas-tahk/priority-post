"use client";

import { useState, useTransition } from "react";
import { createGoal } from "./actions";
import { GOAL_COLORS, CAT_COLOR_VAR } from "./colors";

export function NewGoalForm({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>("side_project");
  const [description, setDescription] = useState("");
  const [isPending, startTransition] = useTransition();

  function submit() {
    if (!name.trim()) return;
    startTransition(async () => {
      await createGoal({ name, color, description });
      onClose();
    });
  }

  return (
    <div className="scrim open" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <h3>New goal</h3>
        <p>Name it, give it a color. Description optional.</p>
        <input type="text" autoFocus placeholder="Goal name" value={name} onChange={(e) => setName(e.target.value)} />
        <label className="field-label">Color</label>
        <div className="swatches">
          {GOAL_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className={`swatch${color === c ? " sel" : ""}`}
              style={{ background: CAT_COLOR_VAR(c) }}
              aria-label={c}
              onClick={() => setColor(c)}
            />
          ))}
        </div>
        <textarea placeholder="What does done look like? (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="btn primary" disabled={isPending || !name.trim()} onClick={submit}>Create goal</button>
        </div>
      </div>
    </div>
  );
}
