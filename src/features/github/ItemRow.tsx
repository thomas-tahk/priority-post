"use client";

import { isStale, NEEDS_YOU, timeAgo, type Label, type TrackedItem } from "./grouping";
import { useSelection } from "./Selection";

function LabelChip({ label }: { label: Label }) {
  return (
    <span
      className="rounded-full px-2 py-px text-xs font-medium"
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

function PrBadge({ item }: { item: TrackedItem }) {
  if (!item.isPr) return null;
  const tone = item.isDraft ? "bg-gray-500" : "bg-green-600";
  return <span className={`rounded px-1.5 text-[11px] font-bold text-white ${tone}`}>{item.isDraft ? "DRAFT" : "PR"}</span>;
}

/** Needs-you titles are written "👉 You: do X"; the section heading already says that. */
function cleanTitle(title: string): string {
  return title.replace(/^👉\s*You:\s*/u, "");
}

type Props = { item: TrackedItem; now: Date; urgent?: boolean };

export function ItemRow({ item, now, urgent = false }: Props) {
  const { selected, select } = useSelection();
  const isSelected = selected === item.url;
  const labels = item.labels.filter((l) => l.name !== NEEDS_YOU);
  const stale = isStale(item, now);
  return (
    <li>
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => select(item.url)}
        className={`block border-l-4 px-4 py-3 transition-colors hover:bg-[var(--surface-2)] ${
          isSelected ? "border-orange-500 bg-[var(--surface-2)]" : "border-transparent"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <span className={urgent ? "text-[17px] font-semibold leading-snug" : "leading-snug"}>
            {urgent ? cleanTitle(item.title) : item.title}
          </span>
          <span className={`shrink-0 text-sm tabular-nums ${stale ? "font-semibold text-amber-600" : "text-[var(--text-faint)]"}`}>
            {timeAgo(item.updatedAt, now)}
          </span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-[var(--text-dim)]">
          <PrBadge item={item} />
          <span className="tabular-nums">
            {urgent && <span className="font-medium">{item.repo} </span>}#{item.number}
          </span>
          {labels.map((l) => (
            <LabelChip key={l.name} label={l} />
          ))}
        </div>
      </a>
    </li>
  );
}
