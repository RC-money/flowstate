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

## Known gaps, deliberate

- **No dive animation.** Entering a cluster is a cut, not a fall.
- **`parse` only knows the three default column names.** "Move X to review" on
  a custom board falls through to `unknown`. The palette and drag work fine;
  only the plain-English path is limited.
- **Andromeda is one image at one size** (559KB). It is not art-directed for
  very wide or very tall panes.
- **The board is still arm64-only** and the Gumroad listing is unwritten --
  see the distribution notes, unchanged by this work.

## Housekeeping done

Stale branches deleted: `feature/starfield-ui`, `flowstate-stable-v1`,
`flowstate-v3-polish`, `rescure/now`. Kept: `main-backup-da655fe` (holds one
commit that is not on `main`), and `claude/vigilant-murdock-3ecdee` (another
session's worktree).

**The checkout at `~/Desktop/flowstate` is still on `Galaxy`**, which is now far
behind. Switch it before testing:

    git -C ~/Desktop/flowstate switch main
