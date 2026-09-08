"use client";

import { useState, useTransition } from "react";
import { applyFactoryLabel } from "./actions";
import type { FoundryAction, FoundryItem } from "./types";

/** One factory item: a single line that opens in place.
 *
 * There is no checkbox. These appear when the factory says they need you and
 * vanish when it says they don't — nothing here is "completed" from this side,
 * and a list that lets you tick off something it doesn't control starts lying. */
export function FoundryStrip({
  item,
  open,
  onToggle,
}: {
  item: FoundryItem;
  open: boolean;
  onToggle: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const primary = item.actions[0];
  const rest = item.actions.slice(1);

  function run(action: FoundryAction) {
    setError(null);
    if (action.kind === "open_url") {
      window.open(action.value, "_blank", "noopener,noreferrer");
      return;
    }
    if (action.confirm && !confirm(`${action.label}: ${item.summary}?`)) return;

    startTransition(async () => {
      const result = await applyFactoryLabel(item.repo, action.number, action.value);
      if (!result.ok) setError(result.reason);
    });
  }

  return (
    <div className={`foundry-strip ${open ? "open" : ""}`} data-state={item.state}>
      <span className="foundry-bar" />
      <div className="foundry-body">
        <div className="foundry-line">
          <button
            type="button"
            className="foundry-what"
            aria-expanded={open}
            onClick={onToggle}
          >
            {item.summary}
          </button>
          <span className="foundry-repo">{shortRepo(item.repo)}</span>
          {!open && primary && (
            <ActionButton action={primary} pending={pending} onRun={run} primary />
          )}
        </div>

        {open && (
          <>
            {item.detail && <p className="foundry-detail">{item.detail}</p>}
            <div className="foundry-acts">
              {item.actions.map((action, i) => (
                <ActionButton
                  key={action.key}
                  action={action}
                  pending={pending}
                  onRun={run}
                  primary={i === 0}
                />
              ))}
            </div>
          </>
        )}

        {error && <p className="foundry-error">{error}</p>}
      </div>
    </div>
  );

  function shortRepo(full: string) {
    return full.includes("/") ? full.split("/")[1] : full;
  }
}

function ActionButton({
  action,
  pending,
  onRun,
  primary,
}: {
  action: FoundryAction;
  pending: boolean;
  onRun: (a: FoundryAction) => void;
  primary: boolean;
}) {
  return (
    <button
      type="button"
      className={`foundry-btn ${primary ? "primary" : ""}`}
      disabled={pending}
      onClick={(e) => {
        e.stopPropagation();
        onRun(action);
      }}
    >
      {action.label}
    </button>
  );
}
