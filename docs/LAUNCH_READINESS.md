# Launch readiness — clusters, columns, Andromeda

Written 2026-08-20, at `be5054c`. For the testing and code-review pass before
release. Everything below is on `main` and `origin/main`.

## What landed

- **Clusters.** Separate boards, one per project. One at a time on the board.
- **Custom columns.** Per cluster, up to 50. The **last column is the finish
  line** -- it earns the star, stops the decay, and gates ethering.
- **Andromeda.** A map of every cluster over a photograph of M31, reached from
  `Cmd-K`. Live clusters are knots on the disc; ethered ones sit out past the
  rim under catalogue names.
- **Allow universe.** In the galaxy view, the other clusters ringed around the
  one you are in, each drawing its own real system. Clicking travels without
  leaving the sky.
- **Two new commands**: `switch` and `assign`.

## Tested 2026-08-20

A pass against real files, driven through the server bundle that actually
ships, plus the app in a browser. 39 file-level assertions and the 418 unit
tests. Three bugs found and fixed; all are in the commits below.

1. **A write against an unreadable file wiped it.** A truncated or half-written
   board parsed as nothing, and the next write saved an empty board over it --
   reporting success. The file could have been one retry from fine. The server
   now distinguishes "no file yet" from "file there but unreadable" and refuses
   to write on the second, saying why.
2. **Removing a column kept completedAt.** A card relocated out of the finish
   line landed in the first column still claiming it was finished, and went on
   earning a star. It goes through `stampCompletion` now.
3. **Assigning across clusters stranded the task.** Clusters have their own
   columns, and the task carried its old one over. The board draws a column's
   cards by matching status, so a status the new cluster had no column for
   showed up nowhere. It lands in the matching column when there is one, the
   first column otherwise, surrendering completedAt if that is not the finish
   line.

Covered and passing: pre-clusters boards read and upgraded without losing
tags, dueDate or completedAt; ten shapes of damaged file repaired rather than
rejected; multi-cluster boards with custom columns; ethered clusters hidden and
unreachable by name; column removal relocating cards; legacy localStorage
migration in the app.

Not covered: the Tauri file watcher (needs the packaged app), drag and drop,
and anything about how it looks.

## Test first, because these can lose data

1. **Open an old board.** A `tasks.json` written before any of this is a bare
   array. It must load into one cluster named Flowstate with every task intact.
   Test the Tauri file *and* the legacy `localStorage` key.
2. **Corrupt the file deliberately.** Remove `clusters`, point a task's
   `clusterId` at nothing, put a string where the array goes. The board must
   survive every one -- `normalizeBoard` repairs, never rejects. Losing a field
   is fine; losing the board is not.
3. **Remove a column that still holds cards.** They fall back to the first
   column. Confirm nothing is stranded in the file but invisible on the board.
4. **Ether a cluster, then reload.** Its tasks stay in the file; the board
   falls to the next live cluster.
5. **MCP round trip.** The server writes the file while the app is open. The
   watcher should adopt it. The server may still write a bare array -- that is
   handled, and worth confirming end to end.

## Review with a sharp eye

- `src/lib/clusters/board.ts` -- the migration. Every branch of it is the
  difference between a repaired board and an empty one.
- `src/hooks/useLocalTasks.ts` -- `TaskStatus` is now `string`, not a union.
  Anything that assumed three statuses is a latent bug; the ones found are
  fixed, but the type no longer catches them.
- `src/lib/commands/run.ts` -- confirm the gate did not widen. Board operations
  only. No cluster creation, no ethering, no styling, no journal.

## The MCP server ships now (was a blocker, fixed 2026-08-20)

It was unreachable for every buyer: `tauri.conf.json` had no `resources`, so
`mcp/` was not in the bundle at all, and the server was a dev script anyway --
`#!/usr/bin/env tsx`, importing `../src/lib/commands`. It only ran from a
checkout.

What changed:

- `npm run build:mcp` bundles `mcp/server.ts` and everything it imports into a
  single `mcp/dist/server.mjs` with esbuild. It runs on plain `node` with no
  tsx, no source tree and no node_modules.
- `npm run build` runs it, and Tauri's `beforeBuildCommand` is `npm run build`,
  so a release cannot be cut without it.
- `resources` copies it to `Contents/Resources/mcp/server.mjs`, which is
  exactly the `SERVER_PATH` constant the Connect panel hands out.

`.mjs`, not `.js`: node reads a bare `.js` as CommonJS and dies on the first
import. Verified end to end -- server launched from inside the built `.app`
with plain `node`, cwd `/`, minimal env: it created a task and listed the
board with cluster names.

**This assumes Node on the buyer's machine.** Fair for people already running
AI coding tools, but it belongs on the listing rather than being a surprise at
setup time.

## Universal build (was a gap, fixed 2026-08-21)

Intel Macs could not launch it at all. `rustup target add x86_64-apple-darwin`
once, then `--target universal-apple-darwin`; `lipo` reports `x86_64 arm64` and
the dmg is ~24MB rather than ~14MB.

`scripts/release-mac.sh` builds universal now and refuses to continue if the
binary is not fat or if `mcp/server.mjs` is missing from the bundle. Both are
silent failures otherwise -- one strands every Intel buyer, the other strands
the feature the listing leads with.

Note on signatures: a plain `npx tauri build` produces an ad-hoc, linker-signed
app with `Sealed Resources=none`, so `codesign --verify --deep --strict` fails
on it. That is expected for a dev build, not a fault. The real signature comes
from the release script with `APPLE_SIGNING_IDENTITY` set.

## Known gaps, deliberate

- **No dive animation.** Entering a cluster is a cut, not a fall.
- **`parse` only knows the three default column names.** It is no longer
  reachable from the UI -- Ask Flow was replaced by Connect your AI -- but the
  MCP server's `flow_move` takes a column name directly and does not go through
  `parse`, so custom columns work there.
- **Andromeda is one image at one size** (559KB). It is not art-directed for
  very wide or very tall panes.
- **The Gumroad listing is unwritten**, and nowhere a buyer can see says the
  MCP server needs Node on their machine.

## Housekeeping done

Stale branches deleted: `feature/starfield-ui`, `flowstate-stable-v1`,
`flowstate-v3-polish`, `rescure/now`. Kept: `main-backup-da655fe` (holds one
commit that is not on `main`), and `claude/vigilant-murdock-3ecdee` (another
session's worktree).

**The checkout at `~/Desktop/flowstate` is still on `Galaxy`**, which is now far
behind. Switch it before testing:

    git -C ~/Desktop/flowstate switch main
