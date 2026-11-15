"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

const STORAGE_KEY = "tracker:selected";
const REFRESH_MS = 60_000;

type Selection = { selected: string | null; select: (url: string) => void };

const SelectionContext = createContext<Selection>({ selected: null, select: () => {} });

export function useSelection(): Selection {
  return useContext(SelectionContext);
}

function readStored(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Re-fetch server data every minute and whenever the tab becomes visible again. */
function useAutoRefresh() {
  const router = useRouter();
  useEffect(() => {
    const refresh = () => document.visibilityState === "visible" && router.refresh();
    const timer = setInterval(refresh, REFRESH_MS);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [router]);
}

export function SelectionProvider({ children }: { children: ReactNode }) {
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => setSelected(readStored()), []);
  useAutoRefresh();

  const select = (url: string) => {
    setSelected(url);
    try {
      localStorage.setItem(STORAGE_KEY, url);
    } catch {}
  };

  return <SelectionContext.Provider value={{ selected, select }}>{children}</SelectionContext.Provider>;
}
