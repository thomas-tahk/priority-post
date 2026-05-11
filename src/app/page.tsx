import { listTasks } from "@/features/tasks/queries";
import { sortByScore } from "@/features/tasks/scorer";
import { AddTaskBar } from "@/features/tasks/AddTaskBar";
import { TaskRow } from "@/features/tasks/TaskRow";

export const dynamic = "force-dynamic";

export default async function Home() {
  const tasks = await listTasks();
  const now = new Date();
  const openRaw = tasks.filter((t) => t.doneAt === null);
  const open = sortByScore(openRaw, now);
  const done = tasks.filter((t) => t.doneAt !== null);

  return (
    <>
      <header className="app-header">
        <h1>
          priority-post
          <span className="dim">v1 · sprint 2 · ranked</span>
        </h1>
      </header>
      <main className="list-pane">
        <AddTaskBar />
        <p className="section-label">
          {open.length === 0 ? "no open tasks" : `${open.length} open · ranked`}
        </p>
        {open.length === 0 ? (
          <p className="empty">Add a task above to get started.</p>
        ) : (
          open.map((t, i) => <TaskRow key={t.id} task={t} isTop={i === 0} />)
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
      </main>
    </>
  );
}
