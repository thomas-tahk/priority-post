import { listOpenItems } from "@/features/github/queries";
import { groupByRepo, needsYou, type TrackedItem } from "@/features/github/grouping";
import { ItemRow } from "@/features/github/ItemRow";

export const dynamic = "force-dynamic";

const card = "rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden";

export default async function Home() {
  let items: TrackedItem[];
  try {
    items = await listOpenItems();
  } catch (err) {
    return <p className="p-4 text-red-600">Could not load GitHub: {(err as Error).message}</p>;
  }
  const now = new Date();
  const urgent = items.filter(needsYou);
  const groups = groupByRepo(items.filter((i) => !needsYou(i)));
  const loaded = now.toLocaleTimeString("en-US", { timeZone: "America/Denver", hour: "numeric", minute: "2-digit" });

  return (
    <div>
      <header className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--surface)]/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-baseline justify-between gap-3 px-4 py-3">
          <h1 className="text-base font-semibold">Open on GitHub</h1>
          <span className="text-xs text-[var(--text-dim)]">
            {items.length} open · {new Set(items.map((i) => i.repo)).size} repos · {loaded}
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-5 px-4 py-5">
        <section>
          <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-orange-600">
            Needs you · {urgent.length}
          </h2>
          <div className={`${card} border-orange-500/60`}>
            {urgent.length === 0 && <p className="p-4 text-sm text-[var(--text-dim)]">Nothing waiting on you.</p>}
            <ul className="divide-y divide-[var(--border)]">
              {urgent.map((i) => (
                <ItemRow key={i.url} item={i} now={now} showRepo />
              ))}
            </ul>
          </div>
        </section>

        {groups.map((g) => (
          <section key={g.repo}>
            <h2 className="mb-2 flex items-baseline gap-2 px-1 text-sm font-semibold">
              <a className="hover:underline" href={`https://github.com/thomas-tahk/${g.repo}`}>
                {g.repo}
              </a>
              <span className="text-xs font-normal text-[var(--text-faint)]">{g.items.length}</span>
            </h2>
            <ul className={`${card} divide-y divide-[var(--border)]`}>
              {g.items.map((i) => (
                <ItemRow key={i.url} item={i} now={now} />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
