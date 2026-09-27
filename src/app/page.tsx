import { listTasks } from "@/features/tasks/queries";
import { listGoals } from "@/features/goals/queries";
import { score } from "@/features/tasks/scorer";
import { orderOpenTasks } from "@/features/tasks/ordering";
import { AppShell } from "@/features/tasks/AppShell";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [tasks, goals] = await Promise.all([listTasks(), listGoals()]);
  const now = new Date();

  const open = tasks.filter((t) => t.doneAt === null);
  const orderedOpen = orderOpenTasks(open, now);
  const scoredOpen = orderedOpen.map((t) => ({ ...t, _score: score(t, now) }));
  const done = tasks.filter((t) => t.doneAt !== null);

  return <AppShell scoredOpen={scoredOpen} done={done} goals={goals} />;
}
