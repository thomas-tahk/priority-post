# priority-post

Personal smart to-do app. Single-user. Owner uses it for themselves.

Core loop: tasks in → Claude triages 5 fields → deterministic scorer ranks → user can override
any field (override removes the sparkle ✨ — the field is now "pinned"). Two views: ranked list,
constellation (packed bubbles, color = category, size = score). Dark mode supported.

## Stack (locked — don't substitute without asking)

- Next.js 16 (App Router) + TypeScript + Tailwind 4 + shadcn/ui
- Postgres in Docker (`docker-compose.yml` at repo root) for dev. Phase 2: Neon.
- Drizzle ORM. Standard SQL only — **no Postgres-only features (jsonb queries, FTS) until phase 3.**
  Keeps the DB swappable.
- Anthropic SDK, server-side only. Never expose API key to client.
  - **Haiku 4.5 (`claude-haiku-4-5-20251001`)** for task triage (high-frequency, simple classification)
  - **Sonnet 4.6 (`claude-sonnet-4-6`)** for "Why this order?" and "Ask AI" prose
  - Prompt caching on system prompt + active task list
- pnpm. Auth.js + magic link is phase 2; v1 is no-auth local-only.

## Architecture rule

Claude is **never** in the critical render path. Triage runs async after task insert; the row appears
immediately with `null` AI fields, then updates when Claude returns. The deterministic scorer is what
sorts the list — it must work with no AI fields populated (use defaults).

LocalStorage is **not** a source of truth. Postgres is. LocalStorage is fine for view preferences
(toggle state, dark mode).

## File layout

```
src/
  app/                  # Next.js App Router routes + server actions
  features/
    tasks/              # CRUD, schema, scorer
    triage/             # Claude triage (Haiku)
    explain/            # "Why this order?" + "Ask AI" (Sonnet)
    constellation/      # SVG packed-bubble view
  db/
    schema.ts           # Drizzle schema
    index.ts            # client
  lib/                  # cross-feature helpers only
```

Feature folders own their own components, server actions, and tests. Cross-feature code goes in `lib/`.

## Data model essentials

`tasks` table:
- `id`, `title`, `notes`, `created_at`, `done_at` (nullable)
- `categories text[]` — **always at least one**; default `['other']`. Multi-cat is supported from Sprint 1.
- AI-inferred fields: `urgency` (int 0-100), `importance` (int 0-100), `est_time_min` (int),
  `focus` (enum: low|medium|high). All nullable until Claude fills them.
- `pinned_fields jsonb` — set of field names the user has overridden. Drives the sparkle ✨ badge
  (badge shows when field is NOT in `pinned_fields`).
- `start_at` (nullable) for scheduled tasks.

## Scorer (deterministic)

```
score = w_urgency * urgency_pressure(now, urgency, start_at)
      + w_importance * (importance / 100)
      + w_fit * fit_now(focus, current_time_of_day)
```

Weights: `w_urgency=0.5, w_importance=0.35, w_fit=0.15`. Ties broken by `created_at` (older first).
Rule: scorer must be a **pure function** — easy to unit test, no DB calls inside.

## UX rules (mockup.html is the visual contract)

`./mockup.html` is the reference. Open in a browser before any UI work. Locked decisions:

- **Constellation colors** (don't substitute):
  - Light: `work #2563eb`, `personal #9333ea`, `health #16a34a`, `learning #ea580c`,
    `errands #0891b2`, `side_project #db2777`, `other #64748b`
  - Dark: brighter siblings — `#3b82f6, #a855f7, #22c55e, #f97316, #06b6d4, #ec4899, #94a3b8`
- **Bubbles only** in constellation. No squares for scheduled tasks. All solid lines.
- **Score encodes size only.** No opacity/saturation gradients.
- **Top task**: 3.5px ring in `var(--accent)` + ~25% size bonus.
- **Multi-cat**: render as overlapping circle lobes (Venn-style), one circle per category.
- **Tag editing**: clicking `+ tag` shows a popover of colored chips immediately. No native `<select>`.
  All edits auto-save.
- **Detail panel**: notes textarea is the prominent area. **No numerical score breakdown** — the
  "Why this order?" prose covers it. Click outside the panel to close.
- **Field naming**: "Focus" (not "Energy"); "Est. time" for unscheduled, "Duration" for scheduled.
- Dark mode toggle in header, defaults to `prefers-color-scheme`.

## Testing

- **Vitest** for unit + integration. `pnpm test` runs the suite.
- Scorer is a pure function → unit tests with table-driven cases.
- DB-touching tests use a separate test database (`priority_post_test`) brought up by the same docker-compose
  with a `test` profile. **No mocks for the DB layer** — owner wants real-DB confidence.
- Triage tests can mock the Anthropic SDK call (don't burn API tokens in CI).

## Commands

- `docker compose up -d` — bring up Postgres
- `pnpm dev` — Next.js dev server
- `pnpm db:generate` / `pnpm db:migrate` — Drizzle migrations
- `pnpm test` — full suite
- `pnpm typecheck` — `tsc --noEmit`

## When to ask vs. when to decide

**Decide silently:**
- Naming (functions, variables, files) when the convention is obvious
- Internal type shapes that don't surface in UI or DB
- Test cases beyond the obvious ones
- Loading states and disabled states unless they conflict with mockup

**Ask first:**
- Anything that changes a locked UX rule above
- Adding a dependency not already in the stack list
- Changing the scorer weights or formula
- Schema changes after Sprint 1
- Anything that exposes API keys client-side or puts Claude in the render path

## Build sequence

See `/Users/tnt/.claude/projects/-Users-tnt-Projects-priority-post/memory/sprint_plan.md` for the
6-sprint plan. Each sprint must end with its verify checkpoint passing before moving on.
