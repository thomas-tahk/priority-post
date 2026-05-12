"use client";

import { useEffect, useState } from "react";
import type { Task } from "@/db/schema";
import { Constellation } from "@/features/constellation/Constellation";
import type { ScoredTask } from "@/features/constellation/layout";
import { AddTaskBar } from "./AddTaskBar";
import { TaskRow } from "./TaskRow";
import { Header, readStoredView, type ViewMode } from "./Header";
import { DetailPanel } from "./DetailPanel";

export function AppShell({
  scoredOpen,
  done,
}: {
  scoredOpen: ScoredTask[];
  done: Task[];
}) {
  const [view, setView] = useState<ViewMode>("list");
  const [selected, setSelected] = useState<Task | null>(null);

  useEffect(() => {
    setView(readStoredView());
  }, []);

  // If the selected task gets refetched (e.g., after a server action), re-pick
  // the new instance so the panel stays in sync with stored data.
  useEffect(() => {
    if (!selected) return;
    const fresh = scoredOpen.find((t) => t.id === selected.id) ?? done.find((t) => t.id === selected.id);
    if (fresh && fresh !== selected) setSelected(fresh);
    if (!fresh) setSelected(null);
  }, [scoredOpen, done, selected]);

  const showList = view === "list" || view === "split";
  const showConstellation = view === "constellation" || view === "split";

  return (
    <>
      <Header view={view} onViewChange={setView} />
      <main className={`view-${view}`}>
        {showList && (
          <section className="list-pane">
            <AddTaskBar />
            <p className="section-label">
              {scoredOpen.length === 0
                ? "no open tasks"
                : `${scoredOpen.length} open · ranked`}
            </p>
            {scoredOpen.length === 0 ? (
              <p className="empty">Add a task above to get started.</p>
            ) : (
              scoredOpen.map((t, i) => (
                <div
                  key={t.id}
                  data-detail-opener
                  onClick={(e) => {
                    // Don't open panel when clicking interactive controls.
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
                <p className="section-label" style={{ marginTop: 28 }}>
                  done · {done.length}
                </p>
                {done.map((t) => (
                  <TaskRow key={t.id} task={t} />
                ))}
              </>
            )}
          </section>
        )}
        {showConstellation && (
          <Constellation
            scored={scoredOpen}
            onSelect={(t) => setSelected(t)}
          />
        )}
      </main>
      <DetailPanel task={selected} onClose={() => setSelected(null)} />
    </>
  );
}
