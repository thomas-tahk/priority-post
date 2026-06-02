"use client";

import { useState, useTransition } from "react";
import { createTask } from "./actions";

export function AddTaskBar({
  goalId = null,
  placeholder = "Add a task… (anything from a quick errand to a big goal)",
  hint = "⏎ to add",
}: {
  goalId?: number | null;
  placeholder?: string;
  hint?: string;
}) {
  const [value, setValue] = useState("");
  const [isPending, startTransition] = useTransition();

  function submit() {
    const title = value.trim();
    if (!title) return;
    startTransition(async () => {
      await createTask({ title, goalId });
      setValue("");
    });
  }

  return (
    <div className="add-bar">
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
        disabled={isPending}
      />
      <span className="hint">{hint}</span>
    </div>
  );
}
