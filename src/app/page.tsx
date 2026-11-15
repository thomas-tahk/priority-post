import { listOpenItems } from "@/features/github/queries";
import { groupByRepo, needsYou, timeAgo, type RepoGroup, type TrackedItem } from "@/features/github/grouping";
import { ItemRow } from "@/features/github/ItemRow";
import { SelectionProvider } from "@/features/github/Selection";

export const dynamic = "force-dynamic";

const card = "rounded-xl border bg-[var(--surface)] overflow-hidden";

function RepoFold({ group, now }: { group: RepoGroup; now: Date }) {
  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none items-baseline justify-between gap-3 px-4 py-3 hover:bg-[var(--surface-2)]">
        <span>
          <span className="mr-2 inline-block text-[var(--text-faint)] text-xs group-open:rotate-90">{"\u25B6\uFE0E"}</span>
          <span className="font-medium">{group.repo}</span>
          <span className="ml-2 text-sm text-[var(--text-faint)]">{group.items.length}</span>
        </span>
        <span className="text-sm text-[var(--text-faint)]">{timeAgo(group.items[0].updatedAt, now)}</span>
      </summary>
      <ul className="divide-y divide-[var(--border)] border-t border-[var(--border)]">
        {group.items.map((i) => (
          <ItemRow key={i.url} item={i} now={now} />
        ))}
      </ul>
    </details>
  );
}

export default async function Home() {
  let items: TrackedItem[];
  try {
    items = await listOpenItems();
  } catch (err) {
    return <p className="p-4 text-red-600">Could not load GitHub: {(err as Error).message}</p>;
  }
  const now = new Date();
  const urgent = items.filter(needsYou);
  const rest = items.filter((i) => !needsYou(i));
  const updated = now.toLocaleTimeString("en-US", { timeZone: "America/Denver", hour: "numeric", minute: "2-digit" });

  return (
    <SelectionProvider>
      <div className="mx-auto max-w-3xl space-y-8 px-4 py-6 text-base">
        <section>
          <div className="mb-3 flex items-baseline justify-between px-1">
            <h1 className="text-2xl font-bold">
              Needs you <span className="text-orange-600">{urgent.length}</span>
            </h1>
            <span className="text-sm text-[var(--text-faint)]">updated {updated}</span>
          </div>
          <div className={`${card} border-orange-500/60`}>
            {urgent.length === 0 && <p className="p-4 text-[var(--text-dim)]">Nothing waiting on you.</p>}
            <ul className="divide-y divide-[var(--border)]">
              {urgent.map((i) => (
                <ItemRow key={i.url} item={i} now={now} urgent />
              ))}
            </ul>
          </div>
        </section>

        <section className="opacity-90">
          <h2 className="mb-1 px-1 text-sm font-semibold uppercase tracking-wide text-[var(--text-dim)]">
            Everything else · {rest.length}
          </h2>
          <p className="mb-3 px-1 text-sm text-[var(--text-faint)]">In progress or backlog — nothing to do.</p>
          <div className={`${card} divide-y divide-[var(--border)] border-[var(--border)]`}>
            {groupByRepo(rest).map((g) => (
              <RepoFold key={g.repo} group={g} now={now} />
            ))}
          </div>
        </section>
      </div>
    </SelectionProvider>
  );
}
