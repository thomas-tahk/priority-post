import { isStale, timeAgo, type Label, type TrackedItem } from "./grouping";

function LabelChip({ label }: { label: Label }) {
  return (
    <span
      className="rounded-full px-2 py-0.5 text-xs font-medium"
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

type Props = { item: TrackedItem; now: Date; showRepo?: boolean };

export function ItemRow({ item, now, showRepo = false }: Props) {
  const kind = item.isPr ? (item.isDraft ? "Draft PR" : "PR") : "Issue";
  return (
    <li className="border-b border-[var(--border)] py-2">
      <a href={item.url} className="font-medium text-[var(--text)] hover:underline">
        {item.title}
      </a>
      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-[var(--text-dim)]">
        <span>
          {showRepo && `${item.repo} `}
          {kind} #{item.number}
        </span>
        <span className={isStale(item, now) ? "font-semibold text-amber-600" : ""}>
          · {timeAgo(item.updatedAt, now)}
        </span>
        {item.labels.length === 0 && <span className="italic text-amber-600">no labels</span>}
        {item.labels.map((l) => (
          <LabelChip key={l.name} label={l} />
        ))}
      </div>
    </li>
  );
}
