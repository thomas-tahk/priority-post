// The shape of the one file the factory publishes and this app reads.
//
// The app knows these four states, because they drive colour and order, and it
// knows the two action kinds. It knows no label names: an action carries the
// string to write and the number to write it to, so the factory can rename its
// whole vocabulary without emptying this list.

export const STATES = [
  "build_failing",
  "waiting_on_you",
  "draft_ready",
  "branch_stranded",
] as const;

export type FoundryState = (typeof STATES)[number];

export type FoundryAction =
  | { key: string; label: string; kind: "open_url"; value: string }
  | {
      key: string;
      label: string;
      kind: "apply_label";
      value: string;
      number: number;
      confirm?: boolean;
    };

export type FoundryItem = {
  id: string;
  repo: string;
  summary: string;
  detail: string;
  state: FoundryState;
  url: string;
  since: string;
  actions: FoundryAction[];
};

export type InboxResult =
  | { ok: true; items: FoundryItem[]; projects: string[]; generatedAt: string }
  | { ok: false; reason: string };
