"use client";

import type { Goal } from "@/db/schema";
import { CAT_COLOR_VAR } from "./colors";

export function GoalRail({
  goals,
  overviewCount,
  countsByGoal,
  selectedGoalId,
  onSelect,
  onNewGoal,
}: {
  goals: Goal[];
  overviewCount: number;
  countsByGoal: Record<number, number>;
  selectedGoalId: number | null;
  onSelect: (id: number | null) => void;
  onNewGoal: () => void;
}) {
  return (
    <aside className="rail">
      <div className="rail-label">View</div>
      <button
        type="button"
        className={`rail-item${selectedGoalId === null ? " active" : ""}`}
        onClick={() => onSelect(null)}
      >
        <span className="glyph">≡</span>
        <span className="name">Overview</span>
        <span className="count">{overviewCount}</span>
      </button>

      <div className="rail-divider" />
      <div className="rail-label">Goals</div>
      {goals.map((g) => (
        <button
          type="button"
          key={g.id}
          className={`rail-item${selectedGoalId === g.id ? " active" : ""}`}
          onClick={() => onSelect(g.id)}
        >
          <span className="dot" style={{ background: CAT_COLOR_VAR(g.color) }} />
          <span className="name">{g.name}</span>
          <span className="count">{countsByGoal[g.id] ?? 0}</span>
        </button>
      ))}

      <div className="rail-add">
        <button type="button" onClick={onNewGoal}>+ new goal</button>
      </div>
    </aside>
  );
}
