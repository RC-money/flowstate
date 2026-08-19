# Flowstate

Your tasks, in motion. A solo task app where your work is a galaxy: tasks are
planets, finished work becomes stars, and neglect dims things gently instead of
shouting at you.

**Flowstate is deliberately single-user.** Its differentiating features are
confessional — "I'm overwhelmed" is a literal input — and they only work
unobserved. Collaboration was considered and rejected, not deferred.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # vitest
npm run lint
npm run build
```

**Flowstate is a desktop app.** The galaxy needs a big screen; there is no
mobile version, on purpose. Ships as a Tauri app (`npx tauri dev` /
`npx tauri build`), where the board lives in a JSON file the MCP server
(`mcp/server.ts`) can also reach. In a plain browser, state lives in
`localStorage` instead.

No backend, no accounts. All state lives in `localStorage` under
`flowstate:v1:*` keys. Export/Import JSON lives in the ⌘K palette.

## The concepts

| Concept | What it is | Where it lives |
|---|---|---|
| **Board / Galaxy** | The two views: kanban columns, or a force-directed starfield | `components/Board.tsx`, `components/GraphView/` |
| **Earned stars** | Completing a task earns a permanent star in the galaxy sky; brightness tracks how long the task lived. Positions derive from a hash of the task id — nothing stored. | `lib/earnedStars.ts` |
| **Orbital decay** | Untouched tasks dim after a 3-day grace period, fully decayed at 14 days. High decay suggests the task for the Dark Forest — never auto-archives. | `lib/orbitalDecay.ts` |
| **Dark Forest** | Where tasks rest when you admit you're not doing them. Restorable. | `components/DarkForestPanel.tsx` |
| **Observer** | Engine computing per-task heat/entropy signals from activity | `engine/observer/` *(the live one)* |
| **Personas / Council** | Seven voices (Mentor, Hunter, Jester…) chosen by your current state | `paradox/council/` *(the live one)* |
| **Biomes** | The background/accent palette shifts with your declared intent and measured state | `engine/biomes/` |
| **Strange Loop** | Reflective questions the app asks you; answers land in the Pattern Journal | `engine/strangeLoop/`, `hooks/useReflectionJournal.ts` |
| **Cosmic events** | Meteor showers etc., derived from aggregate board state | `engine/events/` |
| **Observatory** | The drawer (top right) holding all ambient panels — the board stays first | `components/Observatory.tsx` |
| **Intent Surface** | "How do you want to feel today" — input, not decoration; drives biomes | `components/IntentSurface.tsx` |

## Data model notes

- `Task.createdAt` / `updatedAt` are epoch ms. `dueDate` is a `YYYY-MM-DD`
  calendar day **on purpose** — a timestamp makes a task due the 20th land on
  the 19th west of Greenwich.
- `completedAt` stamps on entering DONE, clears on leaving. It's what earns
  the star.
- Storage migration **repairs rather than rejects** (`lib/taskDates.ts:
  normalizeDates`): the loader discards the whole board if one row fails
  validation, so a strict migration would wipe real data.

## Keyboard

`N` new task · `G` toggle galaxy backdrop · `⌘K` palette (export/import/
observatory live here) · `Esc` closes things.

## History

The design language is documented in `docs/FLOWSTATE_UI_GUIDELINES.md` —
still accurate. A full code audit (Aug 2026) with findings and rationale for
most of the current structure exists as a Claude artifact; the render-loop
fixes, date model, layout calm-down, and dead-code deletion all trace to it.
