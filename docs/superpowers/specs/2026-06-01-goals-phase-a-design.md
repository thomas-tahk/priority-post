# Goals — Phase A (mechanics + rail layout)

**Date:** 2026-06-01
**Status:** Design — awaiting review
**Scope:** Goals you can create, edit, assign tasks to, and filter by, inside a
left-rail layout. The AI "suggest sub-tasks" flow is **Phase B** (separate spec).

## Purpose

Let the owner group tasks under larger goals (e.g. "Run a half marathon"),
navigate by goal in a left rail, and see a goal's own tasks ranked. Tasks can
still exist with no goal and be filed into one later. No behavior change to
scoring or triage — goals are an organizational layer on top of tasks.

## Decisions (from brainstorming)

- Phase the work: **mechanics first** (this spec), AI sub-task suggestions later.
- **Adopt a left rail** for navigation, but keep the existing list/map/split
  view-toggle in the header (don't duplicate views in the rail, don't drop Split).
- Goal selection **filters client-side** (no per-goal routes).
- Task→goal assignment is **contextual at creation, editable later** — never a
  goal/no-goal prompt.
- Deleting a goal is a **deliberate, tucked-away, confirmed** flow that decides
  what happens to the goal's tasks.

## Data model

New `goals` table (standard SQL only — no jsonb/FTS; DB stays swappable):

| column        | type                          | notes                                  |
|---------------|-------------------------------|----------------------------------------|
| `id`          | serial pk                     |                                        |
| `name`        | text not null                 |                                        |
| `description` | text (nullable)               | editable "what does done look like"     |
| `color`       | text not null                 | one of the 7 locked category color keys (reused for the dot) |
| `created_at`  | timestamptz not null default now | drives "started X ago"              |

`tasks` gains:

- `goal_id integer` — nullable FK → `goals.id`, `ON DELETE SET NULL` (safety net;
  the delete flow normally reassigns/deletes tasks explicitly first).

Migration via `pnpm db:generate` + `pnpm db:migrate`. This is the schema change
called out in CLAUDE.md ("ask first") — approved as part of this design.

## Architecture & data flow

- `page.tsx` (already `force-dynamic`) additionally fetches goals. Per-goal
  **open-task counts are computed in JS** from the already-loaded task list — no
  `GROUP BY`, keeps the query layer trivial and DB-swappable.
- `AppShell` becomes the layout orchestrator. New client state: `selectedGoalId`
  (`number | null`). `null` → Overview (all open tasks, existing list/map/split).
  A goal id → the goal page.
- The existing header view-toggle (list / map / split) is **unchanged** and
  applies to the **Overview only**. The goal page is always a ranked list.
- Scorer and triage are untouched. `goal_id` does not enter the scorer. Claude
  stays off the render path.

## Layout

```
┌─ header: title · clock · [list|map|split] toggle · theme ─────────────┐
├─────────────┬─────────────────────────────────────────────────────────┤
│ RAIL        │ MAIN                                                      │
│  Overview   │   selectedGoalId == null → Overview (list/map/split)      │
│  ─────────  │   selectedGoalId == n    → GoalPage (ranked list)         │
│  Goals      │                                                           │
│   • goal A 7│                                                           │
│   • goal B 3│                                                           │
│  + new goal │                                                           │
└─────────────┴─────────────────────────────────────────────────────────┘
```

- **Rail** handles *what* you're looking at (Overview vs a goal), not *how* it
  renders. Each goal row: colored dot + name + open-task count. Active row
  highlighted. `+ new goal` at the bottom.
- The rail design follows `mockups/goals-rail-explore.html` (rail styling, goal
  page header/description/add-bar), minus the dropped "Priority map" rail item
  (the header toggle covers views) and minus the deferred "suggest sub-tasks"
  button and the dropped Inbox.

## Components (new, under `src/features/goals/`)

- `queries.ts` — `listGoals()`; counts derived in `page.tsx`.
- `actions.ts` — `createGoal`, `updateGoal` (name/description/color),
  `deleteGoal` (with task disposition), `assignTaskGoal(taskId, goalId|null)`.
  All `revalidatePath("/")`.
- `GoalRail.tsx` — the left rail (Overview item, goals list, new-goal trigger).
- `GoalPage.tsx` — main pane for a selected goal: editable title, meta
  ("N tasks · M done · started X ago"), editable description, goal-scoped add-bar,
  ranked task list (reuses `TaskRow` + scorer ordering) with a Done section, and
  a settings menu (`⋯`) housing rename/recolor and the delete flow.
- `NewGoalForm.tsx` — name + color (+ optional description) create form.
- `GoalPicker.tsx` — popover used in the detail panel (same pattern as
  `TagPicker`): pick a goal or "No goal."
- `DeleteGoalDialog.tsx` — confirm + task disposition (see below).

Modified: `AppShell.tsx` (rail + selectedGoalId + Overview/GoalPage switch),
`page.tsx` (fetch goals + counts), `DetailPanel.tsx` (Goal field via GoalPicker),
`db/schema.ts`, `app/globals.css` (rail + goal-page styles).

`Header.tsx` is **unchanged** (view-toggle stays).

## Task creation & assignment

- **Add from Overview** → task created with `goal_id = null`.
- **Add from inside a goal** (goal-page add-bar) → task created with
  `goal_id = <that goal>`.
- **Decide later** → open the task's detail panel and use the **Goal field**
  (GoalPicker) to assign/reassign/clear. This is an edit affordance, never a
  creation prompt.

## Goal deletion flow

- Entry point is tucked inside the goal's `⋯` settings menu (not a prominent
  button).
- Opens `DeleteGoalDialog` (confirm — "are you sure"), which requires choosing
  what happens to the goal's tasks:
  1. **Move to All tasks** — set `goal_id = null` (safe default).
  2. **Move to another goal** — reassign `goal_id` to a chosen goal.
  3. **Delete the tasks too** — delete the goal's tasks.
- `deleteGoal(id, disposition)` applies the task change, then deletes the goal,
  in that order. Closing/selecting falls back to Overview afterward.

## Goal colors

Reuse the 7 locked category color keys (`work`, `personal`, `health`,
`learning`, `errands`, `side_project`, `other`) and their existing light/dark CSS
vars for the goal dot. No new color infrastructure. (Swap to a dedicated goal
palette later if desired.)

## Testing

- `assignTaskGoal` and `deleteGoal` (all three dispositions) covered by
  integration tests against the real test DB (`priority_post_test`), per the
  no-DB-mocks rule.
- Per-goal count derivation is a pure function over the task list → unit test.
- Goal CRUD happy-path integration test.

## Out of scope (deferred)

- **Phase B:** AI "suggest sub-tasks" (Sonnet), and the goal-page sparkle button.
- An "Unassigned (N)" rail filter — for now, assign from any task's detail panel.
- Goal-level completion/archiving.
- Per-goal map/split rendering (goal pages are list-only by decision).
- Drag-to-assign.
