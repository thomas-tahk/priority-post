"use client";

import { useEffect, useRef } from "react";
import { CATEGORIES, CATEGORY_LABELS, type Category } from "./categories";

export function TagPicker({
  current,
  onPick,
  onClose,
}: {
  current: string[];
  onPick: (cat: Category) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  const available = CATEGORIES.filter((c) => !current.includes(c));

  return (
    <div className="tag-picker" ref={ref}>
      {available.length === 0 ? (
        <span style={{ fontSize: 11, color: "var(--text-faint)", padding: "2px 6px" }}>
          all added
        </span>
      ) : (
        available.map((cat) => (
          <button
            key={cat}
            type="button"
            className="pill cat"
            data-cat={cat}
            onClick={() => onPick(cat)}
          >
            {CATEGORY_LABELS[cat]}
          </button>
        ))
      )}
    </div>
  );
}
