"use client";

import { useEffect, useState } from "react";
import type { Task, Goal } from "@/db/schema";
import { Constellation } from "@/features/constellation/Constellation";
import type { ScoredTask } from "@/features/constellation/layout";
import { AddTaskBar } from "./AddTaskBar";
import { TaskRow } from "./TaskRow";
import { Header, readStoredView, type ViewMode } from "./Header";
import { DetailPanel } from "./DetailPanel";
import { ExplainStream } from "@/features/explain/ExplainStream";
import { GoalRail } from "@/features/goals/GoalRail";
import { GoalPage } from "@/features/goals/GoalPage";
import { NewGoalForm } from "@/features/goals/NewGoalForm";
import { openCountByGoal } from "@/features/goals/counts";

export function AppShell({
  scoredOpen,
  done,
  goals,
}: {
  scoredOpen: ScoredTask[];
  done: Task[];
  goals: Goal[];
}) {
  const [view, setView] = useState<ViewMode>("list");
  const [selected, setSelected] = useState<Task | null>(null);
  const [selectedGoalId, setSelectedGoalId] = useState<number | null>(null);
  const [newGoalOpen, setNewGoalOpen] = useState(false);

  useEffect(() => { setView(readStoredView()); }, []);

  // Keep the selected task in sync after server-action revalidation.
  useEffect(() => {
    if (!selected) return;
    const fresh =
      scoredOpen.find((t) => t.id === selected.id) ?? done.find((t) => t.id === selected.id);
    if (fresh && fresh !== selected) setSelected(fresh);
    if (!fresh) setSelected(null);
  }, [scoredOpen, done, selected]);

  // If the selected goal was deleted, fall back to Overview.
  useEffect(() => {
    if (selectedGoalId !== null && !goals.some((g) => g.id === selectedGoalId)) {
      setSelectedGoalId(null);
    }
  }, [goals, selectedGoalId]);

  const countsByGoal = openCountByGoal(scoredOpen);
  const activeGoal = goals.find((g) => g.id === selectedGoalId) ?? null;

  const showList = view === "list" || view === "split";
  const showConstellation = view === "constellation" || view === "split";

  return (
    <>
      <Header view={view} onViewChange={setView} showViewToggle={selectedGoalId === null} />
      <div className="app-body">
        <GoalRail
          goals={goals}
          overviewCount={scoredOpen.length}
          countsByGoal={countsByGoal}
          selectedGoalId={selectedGoalId}
          onSelect={setSelectedGoalId}
          onNewGoal={() => setNewGoalOpen(true)}
        />
        <div className="app-content">
          {activeGoal ? (
            <GoalPage
              key={activeGoal.id}
              goal={activeGoal}
              open={scoredOpen.filter((t) => t.goalId === activeGoal.id)}
              done={done.filter((t) => t.goalId === activeGoal.id)}
              goals={goals}
              onSelectTask={setSelected}
              onDeleted={() => setSelectedGoalId(null)}
            />
          ) : (
            <main className={`view-${view}`}>
              {showList && (
                <section className="list-pane">
                  <AddTaskBar />
                  <p className="section-label">
                    {scoredOpen.length === 0 ? "no open tasks" : `${scoredOpen.length} open · ranked`}
                  </p>
                  {scoredOpen.length > 0 && (
                    <div style={{ marginBottom: 14 }}>
                      <ExplainStream request={{ kind: "why" }} buttonLabel="Why this order?" />
                    </div>
                  )}
                  {scoredOpen.length === 0 ? (
                    <p className="empty">Add a task above to get started.</p>
                  ) : (
                    scoredOpen.map((t, i) => (
                      <div
                        key={t.id}
                        data-detail-opener
                        onClick={(e) => {
                          const tag = (e.target as HTMLElement).tagName;
                          if (["INPUT", "BUTTON", "TEXTAREA", "SELECT"].includes(tag)) return;
                          setSelected(t);
                        }}
                      >
                        <TaskRow task={t} isTop={i === 0} />
                      </div>
                    ))
                  )}
                  {done.length > 0 && (
                    <>
                      <p className="section-label" style={{ marginTop: 28 }}>done · {done.length}</p>
                      {done.map((t) => (<TaskRow key={t.id} task={t} />))}
                    </>
                  )}
                </section>
              )}
              {showConstellation && (
                <Constellation scored={scoredOpen} onSelect={(t) => setSelected(t)} />
              )}
            </main>
          )}
        </div>
      </div>
      <DetailPanel key={selected?.id ?? "none"} task={selected} goals={goals} onClose={() => setSelected(null)} />
      {newGoalOpen && <NewGoalForm onClose={() => setNewGoalOpen(false)} />}
    </>
  );
}
