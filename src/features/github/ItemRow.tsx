import { isStale, NEEDS_YOU, timeAgo, type Label, type TrackedItem } from "./grouping";

function LabelChip({ label }: { label: Label }) {
  return (
    <span
      className="rounded-full px-1.5 py-px text-[11px] font-medium leading-4"
      style={{ backgroundColor: `#${label.color}`, color: textColorFor(label.color) }}
    >
      {label.name}
    </span>
  );
}

/** Black or white text, whichever reads on the label's background. */
function textColorFor(hex: string): string {
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? "#000" : "#fff";
}

function KindBadge({ item }: { item: TrackedItem }) {
  if (!item.isPr) {
    return <span className="rounded border border-[var(--border-strong)] px-1 text-[10px] font-semibold text-[var(--text-dim)]">ISSUE</span>;
  }
  const tone = item.isDraft ? "bg-gray-500" : "bg-green-600";
  return <span className={`rounded px-1 text-[10px] font-semibold text-white ${tone}`}>{item.isDraft ? "DRAFT" : "PR"}</span>;
}

type Props = { item: TrackedItem; now: Date; showRepo?: boolean };

export function ItemRow({ item, now, showRepo = false }: Props) {
  const labels = item.labels.filter((l) => l.name !== NEEDS_YOU);
  const stale = isStale(item, now);
  return (
    <li>
      <a href={item.url} className="block px-4 py-3 hover:bg-[var(--surface-2)]">
        <div className="flex items-start justify-between gap-3">
          <span className="text-sm font-medium leading-snug">{item.title}</span>
          <span className={`shrink-0 text-xs tabular-nums ${stale ? "font-semibold text-amber-600" : "text-[var(--text-faint)]"}`}>
            {timeAgo(item.updatedAt, now)}
          </span>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-[var(--text-dim)]">
          <KindBadge item={item} />
          <span className="tabular-nums">
            {showRepo && <span className="font-medium">{item.repo} </span>}#{item.number}
          </span>
          {item.labels.length === 0 && <span className="italic text-amber-600">no labels</span>}
          {labels.map((l) => (
            <LabelChip key={l.name} label={l} />
          ))}
        </div>
      </a>
    </li>
  );
}
