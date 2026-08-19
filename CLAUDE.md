# Flowstate — working notes for agents

Solo, local-first task app. Tasks are planets, finished work becomes stars,
neglect dims things gently. Read `docs/FLOWSTATE_UI_GUIDELINES.md` before
touching anything visual.

## Don't change the bones

These are decisions, not gaps. If a change requires undoing one, stop and ask.

- **Solo-only.** Collaboration was considered and rejected. The differentiating
  features are confessional ("I'm overwhelmed" is a literal input) and only work
  unobserved. Never propose sharing, teams, or presence.
- **`dueDate` is a calendar day (`YYYY-MM-DD`), not a timestamp.** A timestamp
  makes a task due the 20th land on the 19th west of Greenwich. Don't "fix" it.
- **Storage migration repairs rather than rejects** (`lib/taskDates.ts`
  `normalizeDates`). The loader drops the whole board if one row fails
  validation, so a strict migration silently wipes real data.
- **Biomes tint space, they don't paint over it.** Palettes are a wash on the
  existing background, never a replacement surface.
- **Subtasks are stars on the card, never board cards.** They don't get columns.
- **Earned-star positions derive from a hash of the task id.** Nothing is
  stored; don't add a persisted position field.
- **The board comes first.** Ambient panels live in the Observatory drawer and
  stay out of the way.

## Conventions

- Pure logic lives in `src/lib/` and `src/engine/` as arrow-function exports
  with colocated `*.test.ts`. Components stay thin.
- **Pure functions take `now: number` as a parameter.** Never call `Date.now()`
  inside them — it makes them untestable.
- Mutations go through `touchTask` so `updatedAt` stays honest.
- TDD: test first, watch it fail, then implement.

## Commands

```bash
npm run dev     # http://localhost:5173
npm test        # vitest
npm run lint
npm run build
```

## Direction (Aug 2026)

Moving toward local-first: task state migrates out of `localStorage` into a
file on disk so an MCP server can expose the board to the user's own AI. The
command layer (`src/lib/commands/`) is the shared substrate — the ⌘K palette,
and later MCP tools, both call the same `parse` → `resolve` → `run` path.

**The gate is the exposed function surface, not a prompt or an instruction
file.** Any assistant reaching the board can only do what `run()` implements:
board operations only, never styling, layout, biomes, or the graph. Keep it
that way. Journal and intent data stay off the MCP surface — that's the
confessional layer.
