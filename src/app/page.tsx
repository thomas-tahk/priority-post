import { listOpenItems } from "@/features/github/queries";
import { groupByRepo, needsYou, type TrackedItem } from "@/features/github/grouping";
import { ItemRow } from "@/features/github/ItemRow";

export const dynamic = "force-dynamic";

export default async function Home() {
  let items: TrackedItem[];
  try {
    items = await listOpenItems();
  } catch (err) {
    return (
      <main className="mx-auto max-w-3xl p-4">
        <p className="text-red-600">Could not load GitHub: {(err as Error).message}</p>
      </main>
    );
  }
  const now = new Date();
  const urgent = items.filter(needsYou);
  const groups = groupByRepo(items.filter((i) => !needsYou(i)));

  return (
    <main className="mx-auto max-w-3xl p-4 space-y-6">
      <header className="flex items-baseline justify-between">
        <h1 className="text-xl font-semibold">Open on GitHub</h1>
        <span className="text-sm text-[var(--text-dim)]">
          {items.length} open · loaded {now.toLocaleTimeString("en-US", { timeZone: "America/Denver" })}
        </span>
      </header>

      <section className="rounded-lg border-2 border-orange-500 p-3">
        <h2 className="font-semibold text-orange-600">👉 Needs you ({urgent.length})</h2>
        {urgent.length === 0 && <p className="text-sm text-[var(--text-dim)]">Nothing waiting on you.</p>}
        <ul>
          {urgent.map((i) => (
            <ItemRow key={i.url} item={i} now={now} showRepo />
          ))}
        </ul>
      </section>

      {groups.map((g) => (
        <section key={g.repo}>
          <h2 className="font-semibold">
            <a className="hover:underline" href={`https://github.com/thomas-tahk/${g.repo}`}>
              {g.repo}
            </a>{" "}
            <span className="text-sm font-normal text-[var(--text-dim)]">({g.items.length})</span>
          </h2>
          <ul>
            {g.items.map((i) => (
              <ItemRow key={i.url} item={i} now={now} />
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
