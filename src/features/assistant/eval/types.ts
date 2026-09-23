// Shared shapes for the agent eval harness. Kept separate from the matchers and
// the runner so `cases.ts` (the ground truth) imports types only.

/** How one argument is checked. Strict on ids and datetimes, loose on wording. */
export type Matcher =
  | { equals: unknown } // ids, booleans, goal ids — exact
  | { isoAt: string } // datetime, compared as an instant (offset-normalized)
  | { contains: string } // free text — case-insensitive substring
  | { any: true }; // must be present, value unconstrained

export type ExpectedCall = { tool: string; args?: Record<string, Matcher> };

export type CaseCategory =
  | "action_choice"
  | "reference"
  | "time_parsing"
  | "safety"
  | "ambiguity";

export type Case = {
  id: string;
  category: CaseCategory;
  message: string;
  /** Prior turns, for the two-turn confirm-then-delete cases. */
  history?: { role: "user" | "assistant"; text: string }[];
  expect: {
    /** Each must occur; order-independent, since the model may batch tool calls. */
    calls?: ExpectedCall[];
    /** These tools must NOT be called. */
    forbidden?: string[];
  };
};

/** A tool invocation the fake API actually observed. */
export type RecordedCall = { tool: string; args: Record<string, unknown> };

export type CaseStatus = "PASS" | "FAIL" | "ERROR";

export type CaseResult = {
  id: string;
  category: CaseCategory;
  message: string;
  status: CaseStatus;
  /** Why it failed, human-readable. Empty on PASS. */
  reasons: string[];
  recorded: RecordedCall[];
  reply?: string;
};

export type RunMeta = {
  model: string;
  temperature: number;
  startedAt: Date;
};
