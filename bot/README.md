# priority-post bot

A two-way Discord planner for [priority-post](../). Standalone Node/TS service (deploy to Railway) —
it talks to the web app only over HTTPS via `/api/internal/*`, sharing nothing but the secret.

## What it does

- **Proactive:** an 08:00 daily digest (today's top focus + what's slipping) and due-soon / just-overdue
  pings for scheduled tasks. Ping dedup lives in Postgres (`sent_reminders`), so restarts don't double-send.
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

## Deploy (Railway)

1. New Railway service from this repo, root directory `bot/`.
2. Build: `pnpm install`. Start: `pnpm start`.
3. Set every var from `.env.example`. Set `TZ` to your timezone (drives the digest hour).

See the spec's runbook (`docs/superpowers/specs/2026-06-08-discord-planner-design.md`, §8) for the full
go-live checklist including the Discord app setup, the Vercel secret, and the Neon migration.
