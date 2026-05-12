"use client";

import { useEffect, useState } from "react";

export type ViewMode = "list" | "constellation" | "split";
export type ThemeMode = "system" | "light" | "dark";

const VIEW_KEY = "pp:view";
const THEME_KEY = "pp:theme";

export function Header({
  view,
  onViewChange,
}: {
  view: ViewMode;
  onViewChange: (v: ViewMode) => void;
}) {
  const [theme, setTheme] = useState<ThemeMode>("system");

  // Read stored theme on mount and apply.
  useEffect(() => {
    const stored = (localStorage.getItem(THEME_KEY) as ThemeMode | null) ?? "system";
    setTheme(stored);
    applyTheme(stored);
  }, []);

  function applyTheme(t: ThemeMode) {
    const root = document.documentElement;
    if (t === "system") {
      root.removeAttribute("data-theme");
    } else {
      root.setAttribute("data-theme", t);
    }
  }

  function cycleTheme() {
    const next: ThemeMode =
      theme === "system" ? "light" : theme === "light" ? "dark" : "system";
    setTheme(next);
    applyTheme(next);
    localStorage.setItem(THEME_KEY, next);
  }

  const themeIcon = theme === "light" ? "☀" : theme === "dark" ? "☾" : "◐";
  const themeLabel = theme === "system" ? "auto" : theme;

  return (
    <header className="app-header">
      <h1>
        priority-post
        <span className="dim">v1</span>
      </h1>
      <div className="toolbar">
        <div className="view-toggle">
          <button
            type="button"
            className={view === "list" ? "active" : ""}
            onClick={() => persistView("list", onViewChange)}
          >
            List
          </button>
          <button
            type="button"
            className={view === "constellation" ? "active" : ""}
            onClick={() => persistView("constellation", onViewChange)}
          >
            Constellation
          </button>
          <button
            type="button"
            className={view === "split" ? "active" : ""}
            onClick={() => persistView("split", onViewChange)}
          >
            Split
          </button>
        </div>
        <button type="button" className="btn" onClick={cycleTheme} title={`theme: ${themeLabel}`}>
          {themeIcon} {themeLabel}
        </button>
      </div>
    </header>
  );
}

function persistView(v: ViewMode, onChange: (v: ViewMode) => void) {
  localStorage.setItem(VIEW_KEY, v);
  onChange(v);
}

export function readStoredView(): ViewMode {
  if (typeof window === "undefined") return "list";
  const v = localStorage.getItem(VIEW_KEY);
  if (v === "list" || v === "constellation" || v === "split") return v;
  return "list";
}
