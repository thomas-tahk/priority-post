"use client";

import { useState, useTransition } from "react";
import { createTask } from "./actions";

export function AddTaskBar() {
  const [value, setValue] = useState("");
  const [isPending, startTransition] = useTransition();

  function submit() {
    const title = value.trim();
    if (!title) return;
    startTransition(async () => {
      await createTask({ title });
      setValue("");
    });
  }

  return (
    <div className="add-bar">
      <input
        type="text"
        placeholder="Add a task… (anything from a quick errand to a big goal)"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
        }}
        disabled={isPending}
      />
      <span className="hint">⏎ to add</span>
    </div>
  );
}
