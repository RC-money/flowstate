# Flowstate — Gumroad listing copy

Paste-ready. Everything below is claim-checked against the shipping build.

---

## Product name

**Flowstate**

## Tagline (the one-liner under the name)

> Your work is a galaxy. A private task app for one person.

Alternates, if you want a different angle:
- *A task app that dims instead of nagging.*
- *Tasks are planets. Finished work becomes stars.*
- *The task app your AI can tend — but never watch.*

## Price

**$19** — one time. No subscription, no account, no server.

Launch week: **$12** with a discount code. One-time prices are easy to raise
and painful to lower, so the code is the lever, not the list price.

---

## Description

*(Gumroad renders this as the main body. First two lines are what people
actually read — everything after is for the ones already interested.)*

**Flowstate is a task app for exactly one person: you.**

Your tasks are planets. Work you finish becomes a permanent star in your sky.
Tasks you neglect don't turn red or pile up notification badges — they dim,
quietly, and eventually drift to a place called the Dark Forest, where "I'm not
doing this right now" is an honest thing to say instead of a failure.

There is no team view. No sharing, no presence, no one watching. That isn't a
missing feature — it's the point. Flowstate asks you how you want to feel today
and shifts its colors to match. That only works when nobody else can see it.

### Your own AI can tend the board — and only the board

Flowstate ships with an MCP server. Connect it to Claude and you can say
*"what am I avoiding?"* or *"move the auth thing to done"* and your board
actually changes.

Here's the part that matters: the AI can reach exactly six operations — list,
move, create, rest, restore, undo. It cannot change your colors, your layout,
or your galaxy. It cannot read your journal or the intent you set for the day.
That isn't a promise in a prompt that a model might ignore. Those functions
don't exist on the surface it can reach.

Every change it makes is undoable in one call.

### What you get

- **Two views of the same work** — a kanban board, or a force-directed galaxy
  you can pan and drag
- **Earned stars** — every completed task becomes a permanent star, brighter
  the longer the task lived
- **Orbital decay** — untouched tasks dim after three days and fully fade at
  fourteen. Nothing is ever auto-archived; it just gets honest with you.
- **The Dark Forest** — where tasks rest when you admit you're not doing them.
  Always restorable. Nothing is ever deleted for you.
- **Plain-English commands** — "what's rotting", "move payments to in progress"
- **Eight color palettes** that wash over the starfield rather than repainting it
- **Your data is a JSON file on your Mac.** Export it any time in one click.
  No account. No server. Nothing leaves your machine.

### What it isn't

- Not for teams. Ever.
- macOS only today, Apple Silicon and Intel both. iPhone and iPad are in progress.
- Not subscription software. You buy it once.

### Requirements

macOS 10.15 or later, Apple Silicon or Intel — the download is universal.
Roughly 24 MB.

**For the AI features:** connecting an assistant over MCP needs
[Node](https://nodejs.org) on your machine. Most people already running AI
coding tools have it; check with `node --version`. Without it the app is
entirely usable, you just drive the board yourself — or hand your assistant
the board file directly, which needs nothing installed.

iPhone and iPad versions are being built, with the board syncing through your
own iCloud — no account with me, no server in the middle.

---

## Screenshot shot list

In order — the first image is the entire sales pitch.

1. **The galaxy view, populated.** Full-bleed, a real board with 15–20 tasks
   and a good scatter of earned stars. This is the poster.
2. **The board view** in the same palette, so people see it's a real task app
   and not just a toy.
3. **Ask Flow mid-command** — "what's rotting" with the results listed. Shows
   the plain-English layer without needing an AI.
4. **Claude Desktop moving a task**, split-screen with Flowstate updating live.
   This is the differentiator; make it obvious.
5. **The palette picker** open in Settings, showing all eight.
6. **The Dark Forest panel** with a few tasks resting in it.

Use the same palette across all six so they read as one product.

---

## The "Show HN" / Reddit post

Different from the listing — this is a person talking, not a product page.

> **Show HN: Flowstate — a task app where your work is a galaxy, and your own
> AI can tend it**
>
> I built a task app for one person. Tasks are planets; finishing one leaves a
> permanent star. Neglected tasks dim instead of nagging.
>
> The part I think is actually novel: it ships an MCP server, so Claude can
> manage your board — but the tool surface is six board operations. It can't
> touch your styling, and it can't read the journal or the daily intent. That's
> enforced by which functions exist, not by a prompt telling the model to
> behave.
>
> No accounts, no server. Your board is a JSON file on your machine.
> macOS, $19 once.

Post to: Hacker News (Show HN), r/macapps, r/SideProject. Lead with the galaxy
screenshot everywhere.

---

## Notes before you publish

- **Notarize first.** An un-notarized download triggers "Apple cannot verify
  this app," which reads as malware to a buyer who just paid. This is the one
  thing worth delaying launch for.
- The listing says Apple Silicon. If you ship a universal build later, update
  this line.
- Bump the version from 0.1.0 before you list it — 1.0 is a purchase, 0.1.0 is
  a beta.
