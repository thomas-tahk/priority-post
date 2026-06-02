# Drag-and-Drop Task Reordering — Design

**Date:** 2026-06-02
**Status:** Design — awaiting review
**Scope:** Manual drag-and-drop reordering of the open-task list (Overview and within goals). Builds on shipped goals Phase A.

## Purpose & philosophy

The deterministic scorer is a **helpful default, not an authority** — the owner has final say over ordering. Today there is no way to express "I decide this goes here"; the list is whatever the scorer computes. This feature lets the owner drag tasks into the order they want, and that order **wins and persists**. The scorer remains the automation that ranks things until the owner takes over.

The owner already has final say over the *attributes* (urgency/importance are directly editable via the ✨-pin system). This feature adds final say over the *ranking*.

## Model (decided during brainstorming)

- **One global order.** A single manual order per task. The Overview shows it directly; a goal page shows the same order filtered to that goal's tasks. Dragging anywhere updates the one order. (A task ordered high in its goal is also high in Overview.)
- **Manual order is primary and persistent.** Out of the box the list is the scorer's order. The moment the owner drags, their arrangement becomes THE order, saved to the DB (syncs across devices). The scorer no longer overrides hand-placed tasks.
- **No Smart/Manual toggle.** There is one list. Your arrangement is the list. (We explicitly rejected a toggle: it implied either a confusing second "smart view" or a destructive reset.)
- **Order only.** Dragging changes the ranking, **not** the urgency/importance numbers. Those stay independently editable and descriptive. Rationale: the scorer is time-aware (urgency rises toward a start time; "fit" shifts by time of day), so baking an order into urgency/importance would let tasks drift out of place later — exactly the loss we're avoiding. A fixed manual rank stays put.
- **New tasks land at the top** of the manual order.
- **No "re-sort by score" escape hatch in v1.** It is the one genuinely destructive action (throws away the arrangement) and is a trivial future add (null out positions). Deferred. Consequence: once you drag, returning to the pure scorer order means re-dragging — acceptable and rare.
- **A subtle label** signals which order you're seeing: `N open · ranked` (scorer) vs `N open · your order` (manual).

## Data model

Add to `tasks`:
- `position double precision` — nullable. `null` = no manual position (scorer decides). Non-null = a manual rank; lower sorts first. Fractional values allow inserting between two tasks without renumbering. Standard SQL (`ORDER BY position`) — DB stays swappable.

"**Manual mode is active**" is derived, not a flag: it's true when any open task has a non-null `position`. No settings table needed.

## Sort logic (pure, unit-tested)

New pure function `orderOpenTasks(tasks, now)` decides list order:
- Partition open tasks into **positioned** (`position != null`) and **unpositioned** (`position == null`).
- Return `[...positioned sorted by position asc, ...sortByScore(unpositioned, now)]`.
- When nothing is positioned → returns the pure scorer order (today's behavior, unchanged).

`page.tsx` switches the open-list sort from `sortByScore` to `orderOpenTasks`. The first task of the result is "the top task" everywhere (list emphasis + the map's top-task ring follow it). The Priority Map's bubble *positions* are unaffected (still urgency × importance).

## Reorder mechanics

Positions are assigned lazily and adjusted by fractional midpoints.

- **Server action `moveTask(taskId, prevId, nextId)`** — `prevId`/`nextId` are the ids the task now sits between in the displayed list (`null` at an end).
  1. **Seed if needed:** if no open task has a position yet, assign `position = index` to every open task in current scored order (`orderOpenTasks` with all-null == scorer order). This snapshots the scorer's order into a real manual order on the first-ever drag — including a first drag that happens inside a goal page (always seed the full open set, so the global order stays coherent).
  2. **Compute new position:** `prevPos = position(prevId)`, `nextPos = position(nextId)`.
     - both present → `(prevPos + nextPos) / 2`
     - only prev → `prevPos + 1`
     - only next → `nextPos - 1`
     - neither (single-item list) → `0`
  3. Update the dragged task's `position`; `revalidatePath("/")`.
- The midpoint helper is a **pure function**, unit-tested independently of the DB.
- Dragging inside a goal page: neighbors are the adjacent goal tasks; inserting at their midpoint repositions the task globally between them (other tasks keep their positions). Consistent with the one-global-order decision.

**New tasks:** `createTask` gains a small step — if manual mode is active (a `min(position)` query over open tasks returns non-null), set the new task's `position = min - 1` (top). Otherwise leave it `null` (scorer handles it). This keeps "new tasks at top" without a separate flag.

## UI (@dnd-kit — new dependency, approved)

- A new client component **`SortableTaskList`** wraps the open-task rows in `@dnd-kit` `DndContext` + `SortableContext` (vertical list strategy). Each row gets a **drag handle** (a small grip, e.g. `⠿`, shown on the row); the rest of the row keeps its click-to-open-detail behavior. dnd-kit distinguishes drag from click, and the handle is a `<button>` (already ignored by the row's open-detail click guard).
- On drag end: optimistically reorder local state (via React 19 `useOptimistic`, reconciled against props on revalidation, so the list doesn't snap back mid-save), then call `moveTask(taskId, prevId, nextId)`.
- Used by **both** the Overview list (in `AppShell`) and the goal list (in `GoalPage`).
- **List view and the list pane of Split only.** The Priority Map stays spatial — no drag-rank on a 2D map. The drag handle does not appear in the map.
- Respect `prefers-reduced-motion` for drag animations.

## Components & files

- `src/db/schema.ts` + migration — add `position`.
- `src/features/tasks/ordering.ts` (new) — `orderOpenTasks(tasks, now)` + `midpoint(prevPos, nextPos)` pure functions, with tests.
- `src/features/tasks/actions.ts` — add `moveTask`; extend `createTask` for new-at-top.
- `src/features/tasks/SortableTaskList.tsx` (new) — dnd-kit list wrapper rendering existing `TaskRow` + handle + open-detail click + optimistic order.
- `src/app/page.tsx` — sort open via `orderOpenTasks`.
- `src/features/tasks/AppShell.tsx` and `src/features/goals/GoalPage.tsx` — render the open list through `SortableTaskList`; the section label reflects ranked vs your-order.
- `src/app/globals.css` — drag handle + dragging styles.

## Edge cases

- **Done tasks:** unaffected; the done section is separate and not reorderable. A completed task keeps its `position` (harmless); if un-completed it returns to its old slot (or bottom if its position was cleared).
- **Single open task:** drag is a no-op (`position = 0`).
- **Goal with one task:** nothing to reorder; handle still renders but does nothing.
- **Reduced motion:** disable drag transition animation.

## Testing

- `orderOpenTasks` — table-driven unit tests (all-null → scorer order; mixed; positioned-before-unpositioned; tie handling).
- `midpoint` — unit tests for both-neighbors, end insertions, empty.
- `moveTask` and `createTask` new-at-top are thin DB actions — verified via typecheck/build + manual testing, consistent with the project's current practice (no DB integration harness).

## Out of scope (future)

- "Re-sort by score" escape hatch (null out positions) — trivial to add later if wanted.
- Per-context ordering (independent order inside a goal vs Overview).
- Drag-reordering goals themselves in the rail; drag-to-assign a task onto a goal.
- Reordering the done section.
