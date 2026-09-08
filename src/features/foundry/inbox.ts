import { STATES, type FoundryAction, type FoundryItem, type FoundryState, type InboxResult } from "./types";

const ORDER = new Map(STATES.map((s, i) => [s, i] as const));

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function parseAction(raw: unknown): FoundryAction | null {
  if (!isRecord(raw)) return null;
  const key = text(raw.key);
  const label = text(raw.label);
  const value = text(raw.value);
  if (!key || !label || !value) return null;

  if (raw.kind === "open_url") return { key, label, kind: "open_url", value };

  // A write has to say what it writes to. Without a number this app would have
  // to guess, and guessing means labelling the wrong issue.
  if (raw.kind === "apply_label" && typeof raw.number === "number") {
    return {
      key,
      label,
      kind: "apply_label",
      value,
      number: raw.number,
      ...(raw.confirm === true ? { confirm: true as const } : {}),
    };
  }
  return null;
}

function parseItem(raw: unknown): FoundryItem | null {
  if (!isRecord(raw)) return null;
  const state = raw.state;
  if (typeof state !== "string" || !ORDER.has(state as FoundryState)) return null;

  const id = text(raw.id);
  const summary = text(raw.summary);
  if (!id || !summary) return null;

  const actions = Array.isArray(raw.actions)
    ? raw.actions.map(parseAction).filter((a): a is FoundryAction => a !== null)
    : [];

  return {
    id,
    repo: text(raw.repo),
    summary,
    detail: text(raw.detail),
    state: state as FoundryState,
    url: text(raw.url),
    since: text(raw.since),
    actions,
  };
}

/** Read the published inbox, dropping anything this app cannot render honestly.
 *
 * An unknown state drops the item — colour and order are driven by it, so a
 * state this app has never heard of would render as something it is not. An
 * unknown action drops only that action: the item is still true, it just has
 * one fewer button. */
export function parseInbox(raw: unknown): InboxResult {
  if (!isRecord(raw) || !Array.isArray(raw.items)) {
    return { ok: false, reason: "The factory's inbox is not in a shape this app can read." };
  }

  const items = raw.items
    .map(parseItem)
    .filter((i): i is FoundryItem => i !== null)
    .sort((a, b) => {
      const byState = ORDER.get(a.state)! - ORDER.get(b.state)!;
      return byState !== 0 ? byState : a.since.localeCompare(b.since);
    });

  const projects = Array.isArray(raw.projects)
    ? raw.projects.filter((p): p is string => typeof p === "string" && p.length > 0)
    : [];

  return { ok: true, items, projects, generatedAt: text(raw.generated_at) };
}
