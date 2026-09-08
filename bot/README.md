# priority-post bot

A two-way Discord planner for [priority-post](../). Standalone Node/TS service (deploy to Railway) —
it talks to the web app only over HTTPS via `/api/internal/*`, sharing nothing but the secret.

## What it does

- **Proactive:** an evening planning digest (default 16:45 local — what's worth doing tonight and what
  slipped today) and due-soon / just-overdue pings for scheduled tasks. Pings are only delivered inside
  your active hours (default 16:00–22:00); outside that window they're skipped, not queued. Ping dedup
  lives in Postgres (`sent_reminders`), so restarts don't double-send.
- **Conversational:** talk to it in the configured channel — "what's next?", "add: call dentist friday 3pm",
  "reschedule taxes to Monday", "mark the gym task done", "break down 'launch the newsletter'", "how am I
  doing this week?". It acts on your real tasks and confirms what it did. Deletes are confirmed first.

## Architecture

```
Discord ⇄ this bot (Railway) ──HTTPS──► priority-post web app (Vercel) ──► Neon Postgres
          · discord.js gateway          · /api/internal/* (x-internal-secret)
          · Anthropic tool-use loop     · triage, scorer, digest, decompose
          · node-cron scheduler
```

The bot holds only the conversational/orchestration AI. Triage, scoring, digest, and goal-decompose
all run in the web app — no duplicated logic.

## Run locally

```bash
cd bot
pnpm install
cp .env.example .env   # fill in the values
pnpm dev               # or: pnpm start
```

`pnpm test` runs the unit tests (formatter + agent loop with fakes — no live Discord/Anthropic).
`pnpm typecheck` runs `tsc --noEmit`.

### Test the agent without Discord

`pnpm repl` drives the agent loop from the terminal — same tool-use → `/api/internal/*` → DB chain
the bot uses, just no Discord gateway. Point it at a **local** web app (the agent can create, complete,
and delete real tasks), and it only needs three env vars:

```bash
WEB_BASE_URL=http://localhost:3000 INTERNAL_API_SECRET=testsecret ANTHROPIC_API_KEY=sk-... pnpm repl
```

Then type like you would in Discord: `what's next?`, `add: call dentist friday 3pm`, `how am I doing?`.
`/exit` to quit.

## Measure the agent's judgment (`pnpm eval`)

`pnpm test` proves the tool-use loop is *wired up* — it feeds `runAgent` scripted replies, so it would
pass even if the real model deleted the wrong task every time. `pnpm eval` measures the decision itself:
40 realistic sentences through the real agent against the real Claude API, scored on which tools got
called with which arguments.

```bash
cd bot
pnpm eval          # needs ANTHROPIC_API_KEY; nothing else — no DB, no web app, no Discord
```

It is deliberately **not** part of `pnpm test`: it costs API money and isn't perfectly deterministic,
and green CI must not depend on a model's mood. Everything except the network call — matching, scoring,
reporting — is pure and covered by `pnpm test`.

Cases live in `eval/cases.ts`, scored against a fixed fixture account (`eval/world.ts`: 12 tasks,
3 goals, clock pinned to Monday 2026-07-20 18:00 Mountain). Results are grouped into `action_choice`,
`reference`, `time_parsing`, `safety` and `ambiguity`, with **safety reported as its own headline** —
`delete_task` is the one irreversible tool the agent owns. Reports land in `eval/reports/` (git-ignored;
commit the ones worth keeping).

The runner **refuses to start outside `America/Denver`**. The agent infers the owner's UTC offset from
`now.toString()` in its system prompt, which renders in the *process* timezone — there is no explicit
timezone contract. Run the eval in another zone and every expected datetime is scored against the wrong
offset, which looks exactly like broken time parsing. `pnpm eval` sets `TZ` for you.

Treat a 1-case movement between runs as noise and a 5-case movement as signal.

## Deploy (Railway)

1. New Railway service from this repo, root directory `bot/`.
2. Build: `pnpm install`. Start: `pnpm start`.
3. Set every var from `.env.example`. **`TZ` is load-bearing, not cosmetic** — it sets the digest time,
   the active-hours window, *and* the UTC offset the agent resolves "friday 3pm" against.

See the spec's runbook (`docs/superpowers/specs/2026-06-08-discord-planner-design.md`, §8) for the full
go-live checklist including the Discord app setup, the Vercel secret, and the Neon migration.
