# Foundry in the list — design

Date: 2026-09-07
Status: **built** (both repos), not yet pushed or live
Stages covered: **1** (factory items in the list + hourly tick + Discord digest) and **3** (plain-English intake).
Deferred: **2** (Discord buttons/slash commands) — gated on a week of living with stage 1.

## Done-gate

> At 8pm my phone shows a Discord message listing what needs me. I open priority-post,
> tap "Build it" on a proposal, and within the hour a draft pull request exists that I did
> not create by hand.

Not "tests pass". Not "merged". That sentence, executed.

---

## 1. The contract: `inbox.json`

Foundry publishes one file. priority-post reads only that file. Neither knows the other's internals.

**Published to:** `inbox/inbox.json` on `main` in `thomas-tahk/foundry`, rewritten by a new
`scripts/inbox_publish.py` that runs at the end of each existing loop (census, propose, build, warm).

```json
{
  "generated_at": "2026-09-07T18:00:00Z",
  "projects": ["thomas-tahk/pocket-draft", "thomas-tahk/priority-post", "thomas-tahk/knowflow"],
  "items": [
    {
      "id": "priority-post#42",
      "repo": "thomas-tahk/priority-post",
      "number": 42,
      "summary": "Add a settings screen for digest time",
      "detail": "Written from your note that the digest hour is buried in an env var.",
      "state": "waiting_on_you",
      "url": "https://github.com/thomas-tahk/priority-post/issues/42",
      "since": "2026-09-05T14:02:00Z",
      "actions": [
        { "key": "approve", "label": "Build it", "kind": "apply_label", "number": 42, "value": "factory:approved" },
        { "key": "decline", "label": "Not now",  "kind": "apply_label", "number": 42, "value": "factory:declined", "confirm": true }
      ]
    }
  ]
}
```

**The rule that makes this work:** priority-post **never hardcodes a `factory:*` string**. It
applies whatever `value` the contract hands it. Foundry can rename every label tomorrow and
priority-post keeps working.

`state` is a small closed vocabulary priority-post *does* know, because it drives colour:
`waiting_on_you` · `draft_ready` · `build_failing` · `branch_stranded`.

`kind` is likewise closed: `apply_label` (a write priority-post makes) and `open_url`
(no write — just a link). **There is no `merge` kind, ever.** Merging stays on GitHub.

**Every `apply_label` action carries its own `number`** — found during the build: `factory:try-again`
goes on the *pull request*, not on the issue that spawned it. An action that inherited the item's
number would label the wrong thing.

`projects` is the elected list, carried in the same file so the plain-English intake (§4) can offer
those projects and only those. Electing a project stays the one switch.

### Validation
priority-post validates the file on read and **renders nothing rather than something wrong**
if it fails: unknown `state` → item dropped; unknown `kind` → that action dropped, item kept;
malformed file → the strip band shows "Foundry's inbox couldn't be read" with a link to the raw file.

---

## 2. priority-post: how items appear

Design chosen: **option E** (`mockups/foundry-in-the-list.html`).

- One line per item, sitting **among** real tasks, not in a separate block.
- **No checkbox.** Items appear when foundry says they need you and vanish when it doesn't.
  Nothing about them is "completed" from this side.
- 3px left edge carries `state` colour. Amber `#b45309` / `#d97706` dark for everything;
  `--danger` for `build_failing`.
- Primary action inline on the right. Tapping the strip opens it in place for `detail` and the
  remaining actions. **One open at a time.**
- Long summaries **wrap**, never truncate, under 480px.

### Placement in the order — a decision, flag if wrong
Factory items have no urgency/importance/score, so they cannot be ranked by the scorer, and they
are not rows in `tasks` so they cannot be dragged.

**Rule: they sit directly beneath the top task.** Your single most important thing keeps the top
slot; the factory sits where you cannot scroll past it. Within the band, order is `state`
(`build_failing` first, then `waiting_on_you`, `draft_ready`, `branch_stranded`), then oldest `since` first.

### Not persisted
Factory items are **fetched server-side per render** (60s cache), never written to Postgres.
A cached copy would eventually disagree with GitHub, and a list that lies gets abandoned.
No migration is needed for stage 1's display.

### Files
```
src/features/foundry/
  inbox.ts          fetch + validate the contract (pure parse, unit-tested)
  types.ts
  actions.ts        server actions: applyLabel(repo, number, value)
  FoundryStrip.tsx  option E, one item
  FoundryBand.tsx   the ordered band
```

---

## 3. The hourly tick

**No always-on host. No new accounts. $0/mo.** All the brains already live in the app as
`/api/internal/*`; the tick only supplies a timer and a way to post.

- `.github/workflows/tick.yml` in **priority-post** (public repo = free unlimited Actions),
  `cron: '0 * * * *'`, `POST /api/internal/tick` with the `INTERNAL_API_SECRET` header.
- **The workflow is fixed and never edited. What the tick *does* is runtime state.**
- At-least-daily is guaranteed by asking *"is it past the digest hour AND has today's digest not
  gone out?"* — not *"is it 20:00?"*. A skipped tick fires an hour late instead of never.
  A new `sent_digests` table (migration `0004`) is the record of what already went out —
  found during the build: `sent_reminders` is task-scoped with a foreign key, so a digest,
  which belongs to no task, cannot be recorded in it.
- Due-soon pings stay gated to the active-hours window; outside it, events are **dropped, not queued**.
- Digest posts via **Discord webhook** — no bot, no token, no intents, no gateway.
- GitHub disables scheduled workflows after 60 days without a commit to the repo.

### Timezone — the landmine
Railway let `TZ` be ambient. **GitHub Actions runners and Vercel functions are both UTC**, and
Vercel's cannot be set. So the timezone must stop being ambient and become an explicit contract:

- New env var `APP_TIMEZONE` (`America/Denver`), read only through the existing config module.
- Every digest-hour, active-window, and "friday 3pm" resolution takes the zone from that value.
- **The agent's system prompt must state the timezone explicitly** rather than embedding
  `now.toString()` and inheriting the process zone. That exact bug scored the eval 27/40 once,
  with all 13 failures being a one-hour offset — the model was correct given what it was told.
- A test asserts the resolved offset, so a silent zone change fails the build rather than the digest.

---

## 4. Stage 3: plain-English intake

Independent of everything above — it shares no data shape with the inbox, which is why it can be
built alongside stage 1 rather than after it.

A single box in priority-post: *"make the golf app deploy"*.

1. Haiku turns the sentence into `{ repo, title, body }`, choosing `repo` from the elected list only.
2. **You see it and confirm before anything is created.** The model never files unattended.
3. On confirm, priority-post creates a normal GitHub issue via the API.
4. Foundry's builder already accepts a hand-written issue with no citation — nothing new is needed
   on the foundry side. That is what makes this cheap.

The created issue then shows up in the inbox on the next publish, closing the loop.

---

## 5. What you have to do by hand

| Step | Where |
|---|---|
| Mark PR #2 ready, merge it | GitHub |
| Run `DATABASE_URL='<neon prod>' pnpm db:migrate` (migrations `0003` + `0004`) | your machine |
| Add `GITHUB_TOKEN` (issues: read+write on elected repos) | Vercel |
| Add `DISCORD_WEBHOOK_URL` | Vercel |
| Add `APP_TIMEZONE=America/Denver` | Vercel |
| Add `INTERNAL_API_SECRET` as an Actions secret | priority-post repo |

`INTERNAL_API_SECRET` is already set in Vercel. `/api/internal` is already exempt from the
basic-auth gate (`src/proxy.ts:8`). Reading the inbox needs **no** token — the hub is a public
repo — so the list works before `GITHUB_TOKEN` is set; only acting on an item needs it.

---

## 6. Open, and deliberately not decided here

- **The band's placement rule** (§2) is my call, not yours yet. Built and verified: the rendered
  list is top task → factory strips → the rest. If that is wrong, the alternatives are
  top-of-list or bottom-of-list; changing it is a one-line change.
- **The eval's 40/40 is provisional** until `bot/eval/cases.ts` is rewritten in your own voice.
  I wrote both the cases and the system under test — the exact trap that sank the ITSM demo.
  This is unrelated to stages 1 and 3 but is the reason not to trust that number in a portfolio claim.
- **No `list_goals` tool exists**, so the agent cannot resolve "the newsletter goal" to a goal id.
  Separate from this work; worth filing.
