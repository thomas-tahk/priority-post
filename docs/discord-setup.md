# Talking to the planner from Discord

This wires `/pp` into Discord so you can ask the planner anything, from anywhere,
at any hour — phone, watch, desktop — and get an answer back in the same thread.

There is **no server to keep running**. Discord calls the web app when you type a
command, the app answers, and nothing sits idle in between. That is why this costs
nothing and why it cannot be "down" unless the whole site is.

Ten minutes, start to finish. Do the steps in order — step 6 needs step 3.

---

## What you end up with

```
Your phone ──► Discord ──signed POST──► priority-post.vercel.app/api/discord
                                              │
                                              ├─► Claude (tools: list/add/reschedule/…)
                                              └─► Neon Postgres
```

You type `/pp what's next?` and get a reply. You type `/pp add: swap the AP uplink
friday at 2pm` and the task is in your list before you put the phone down.

The evening digest and due-soon pings do **not** change — those still come from the
hourly tick, exactly as they do today.

---

## Step 1 — Create the Discord application

1. Go to https://discord.com/developers/applications and click **New Application**.
2. Name it whatever you want to see in Discord (e.g. `priority-post`). Create.
3. Left sidebar → **Bot** → **Reset Token** → copy it.
   You need this once, in step 5, and never again. Paste it straight into
   `.env.local` — don't leave it in a chat window or a note.

On the **General Information** page, two values are waiting for you:

| Where it is | What it's called here |
|---|---|
| **Application ID** | `DISCORD_APP_ID` |
| **Public Key** | `DISCORD_PUBLIC_KEY` |

Both are safe to copy around. The bot token from step 1.3 is not.

---

## Step 2 — Find your own Discord user ID

The signature proves *Discord* sent the request. It does not prove *you* typed it.
Your user ID is what locks the planner to you — anyone else who finds the command
gets a polite refusal, visible only to them.

1. Discord → **User Settings** → **Advanced** → turn on **Developer Mode**.
2. Right-click your own name anywhere → **Copy User ID**.

That's `OWNER_DISCORD_ID`. It's a long number, not your username.

---

## Step 3 — Add the environment variables in Vercel

Vercel dashboard → the `priority-post` project → **Settings** → **Environment
Variables**. Add these three to **Production**:

| Name | Value |
|---|---|
| `DISCORD_APP_ID` | Application ID from step 1 |
| `DISCORD_PUBLIC_KEY` | Public Key from step 1 |
| `OWNER_DISCORD_ID` | Your user ID from step 2 |

These should already be there from the hourly tick — check, don't re-add:
`DATABASE_URL`, `ANTHROPIC_API_KEY`, `APP_PASSWORD`, `INTERNAL_API_SECRET`,
`DISCORD_WEBHOOK_URL`.

Optional: `APP_TIMEZONE` (defaults to `America/Denver`) and `WEB_BASE_URL`
(defaults to the deployment's own URL, which is what you want).

**Do not skip the redeploy.** Vercel only picks up new variables on the next
build: **Deployments** → newest → **⋯** → **Redeploy**.

---

## Step 4 — Run the migration

The conversation is remembered in a new `assistant_turns` table — that's how a
follow-up like "move it to Saturday instead" knows what *it* is.

```bash
pnpm db:migrate
```

⚠️ In this repo `.env.local` points at **Neon production**, not the Docker
container. That is what you want here — but it means this command changes the
real database. It creates one table and touches nothing existing.

---

## Step 5 — Register the `/pp` command

From the repo root, with `DISCORD_APP_ID` and `DISCORD_BOT_TOKEN` in `.env.local`:

```bash
pnpm discord:register
```

Expected output:

```
Registered /pp. It can take up to an hour to appear the first time.
```

Run this once. Run it again only if you change the command's name, description,
or options — it updates in place rather than creating a duplicate.

---

## Step 6 — Point Discord at the endpoint

Back in the Discord developer portal, **General Information** →
**Interactions Endpoint URL**:

```
https://priority-post.vercel.app/api/discord
```

Click **Save**.

Discord immediately sends two test requests — one correctly signed, one
deliberately broken — and refuses to save unless the app accepts the first and
rejects the second with a 401. **If it saves, the security half is already
proven.** If it refuses, jump to Troubleshooting.

---

## Step 7 — Install it where you'll use it

Still in the portal: **Installation** → under **Install Link** pick **Discord
Provided Link**, then open that link.

You get two choices:

- **Add to My Apps** — `/pp` works in a DM with the app, anywhere in Discord,
  with no server involved. **Pick this one.**
- **Add to Server** — also fine if you'd rather it live in a channel.

Both can be enabled. The first is what makes it work from your phone without
opening a server.

---

## Step 8 — The done-gate

Open Discord on your **phone**, DM the app, and send:

```
/pp what's next?
```

You should see "thinking…" for a few seconds, then the actual answer, naming
your real tasks.

Then prove it writes, not just reads:

```
/pp add: swap the AP uplink friday at 2pm
```

Open https://priority-post.vercel.app and confirm the task is there, scheduled
for **2:00 PM**, not 8:00 PM. (That six-hour version was a real bug; it is fixed
and covered by tests, but this is the check that proves it on production.)

That is the gate. If both of those worked on your phone, you're done.

---

## What you can say

`/pp` takes one free-text message. It is a conversation, not a syntax.

| You type | It does |
|---|---|
| `what's next?` · `plan my evening` | Today's top focus plus what's slipping |
| `add: call the dentist friday 3pm` | Creates the task, scheduled |
| `reschedule taxes to monday` | Moves it |
| `mark the gym task done` | Completes it |
| `break down "launch the newsletter"` | Proposes sub-tasks, adds none until you say yes |
| `how am I doing this week?` | Progress over the last 7 days |
| `reset` | Forgets the conversation so far; your tasks are untouched |

It remembers the last 16 turns, so "move it to Saturday instead" works.
Deletes always ask for confirmation first.

---

## Troubleshooting

**Discord won't save the endpoint URL.**
Nearly always one of: the deployment hasn't been redeployed since you added
`DISCORD_PUBLIC_KEY`; the key was pasted with a stray space; or you pasted the
Application ID into the public key field. Redeploy, then re-check the value.

**"The application did not respond."**
Discord gave up waiting for the first acknowledgement (3 seconds). Check the
function log in Vercel → **Logs**. If the endpoint 500s, an env var is missing —
the log names which one.

**It's stuck on "thinking…" forever.**
The acknowledgement landed but the follow-up didn't. Vercel → **Logs**, look for
`discord follow-up failed:` — the line says what Discord refused.

**Someone else's `/pp` does nothing useful.**
Working as designed. They get "This planner only answers to its owner." — ephemeral,
so nobody else in the channel sees it either.

**Replies are slow.**
The agent may take several model round-trips for a complex ask. The function is
allowed 300 seconds and Discord holds the interaction open for 15 minutes, so it
will land; it just isn't instant.

---

## Notes

- The gateway bot that used to live in `bot/` has been **deleted**. It was never
  deployed, and running it alongside this would have posted a second, older
  evening digest every night. Its eval harness survived the move and now lives in
  `src/features/assistant/eval` (`pnpm eval`), where it scores the agent that
  actually answers. Its June setup guide is kept in `docs/archive/`.
- Security boundary, in order: Discord's Ed25519 signature (proves the request is
  from Discord and unaltered) → your user ID (proves it's you) → `INTERNAL_API_SECRET`
  (the endpoint talking to the app's own API). The basic-auth password does not
  apply here; `/api/discord` is exempt in `src/proxy.ts`, as `/api/internal` already was.
- Times are resolved in `APP_TIMEZONE`, stated explicitly to the model. Vercel
  functions run in UTC and cannot be changed, which is exactly why the zone is
  named rather than inferred.
