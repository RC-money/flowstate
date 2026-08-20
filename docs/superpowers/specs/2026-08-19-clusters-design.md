# Clusters: many boards, one sky

Status: approved in brainstorming, 2026-08-19.

## The idea

Today Flowstate holds one board. This adds **clusters** -- separate
three-column boards, one per project. You work in one at a time. When every
task in a cluster is finished you send the whole cluster into the ether, and it
leaves the board to become a distant galaxy in the background. The deep field
fills only with work you actually completed.

## The metaphor, and why it is shaped this way

Live clusters are **star clusters inside one home galaxy** -- your Milky Way.
Ethered clusters become **galaxies** out in the deep field.

The rejected alternative was "a live project is a galaxy". It puts galaxies
inside a galaxy, which is why the selector was hard to draw. A star cluster
genuinely lives inside a galaxy, so the hierarchy runs cleanly:

    subtask -> moon
    task    -> planet
    done    -> star
    project -> cluster (live) / galaxy (ethered)
    all of it -> the universe

## Naming

The domain type is `Cluster`. `graphPhysics.ts` already uses `cluster*` for the
*emergent* groupings that feed the constellation analyzer; those are renamed to
`constellation*`, which is what they actually are. Contained to one file, and it
removes the collision rather than working around it.

## Data model

```ts
export interface Cluster {
  id: string;
  name: string;        // the user's project name
  createdAt: number;
  etheredAt?: number;  // sent to the ether: off the board, out in the deep field
}
```

Plus one field on `Task`: `clusterId: string`.

## Storage: repairs, never rejects

`coerceTasks` returns `null` on one bad row and the loader drops the whole
board, so the migration must never be strict. The persisted payload accepts both
shapes:

- **An array** -- every board that exists today. Wrapped into one cluster named
  "Flowstate"; every task gets its `clusterId`. Silent, lossless.
- **An object** `{ clusters, tasks }` -- read as is. A task whose `clusterId`
  names no cluster is repaired into the default cluster. A missing or corrupt
  `clusters` array is rebuilt from the cluster ids the tasks reference.

Same rule as `normalizeDates`: a damaged file costs the user a field, never
their board.

## The board

One cluster at a time, full width, three columns, exactly as today. A cluster
switcher sits above the columns as pills, with `+`. Also reachable by `Cmd-1..9`
and the palette. The active cluster id lives in `sessionStorage` beside
`flowstate:view`.

No side-by-side boards. The board comes first, and four half-width boards is
not the board coming first.

Everything ambient -- Observatory, biomes, Dark Forest, the journal -- stays
global. You have one mood, not one per project.

## Galaxy view: three depths

- **Inside** (default, unchanged) -- the active cluster. Planets orbit, rings
  tilt, moons space themselves.
- **The disc** -- top-down view of the home galaxy, turning once in a minute
  plus. Each live cluster is a knot on a spiral arm.
- **The deep field** -- ethered clusters, dim and far, drawn behind both. An
  Observatory toggle hides them; some days a wall of finished work is the wrong
  thing to look at.

The disc lives in its own `ClusterField.tsx` sharing the star and node
primitives. `GraphView.tsx` is already 2077 lines and does not get a third
branch.

### The knots

- **Position** -- arm index and radius from a hash of the cluster id. Fixed
  forever, so the user learns their own sky. Nothing stored, matching the
  earned-star rule.
- **Size** -- live task count.
- **Brightness** -- recent activity, straight off `decayLevel`. A project
  untouched for three weeks is visibly dim before you read a word of it.
- **Hover** -- name, "7 open / 3 in flight", and its arm brightens along its
  length.
- **Click** -- the camera dives, the knot blooms into the orbit view, and the
  board takes that cluster as active. The two views never disagree.

## Getting into the selector: two doors

Switching happens forty times a day; choosing happens once a morning. They are
different moments and get different doors.

- **Fast** -- the pills, `Cmd-1..9`, `Cmd-K switch <name>`. No animation, no
  ceremony. This is the one that gets worn out.
- **Cool** -- the board recedes. The wordmark (or `Cmd-Shift-K`) dissolves the
  columns backward and leaves you above the disc; picking falls the board back
  in around you. About 600ms each way. In Galaxy view it is simply the next zoom
  step out -- same disc, no second implementation.

A modal listing projects would be a webapp affordance in a space app. The board
receding into the sky is the gesture this app already makes everywhere else.

Keyboard: arrows cycle knots, Enter dives, Escape returns. Reduced motion: the
disc holds still, the dive becomes a cross-fade.

## Catalog names

An ethered cluster keeps the user's name and gains a catalog designation
derived from a hash of its id: a prefix (`NGC`, `IC`, `Messier`, `Abell`) and a
number. "Flowstate v2" becomes NGC 4414 the moment it is ethered and stays NGC
4414 forever. Distance, angle, tilt and arm count fall out of the same hash,
with an older `etheredAt` sitting further out, so the universe visibly deepens
as work finishes. Nothing is stored; it survives export and import.

## Sending a cluster to the ether

Offered only when every task in the cluster is DONE or already ethered -- the
ceremony has to be earned. It stamps `etheredAt` on the cluster. The tasks stay
in the file untouched, because their titles are what the stars *are*; they just
leave the board and the near depths. If the ethered cluster was active, the
board falls to the next live one. Undoable for one toast, like every other
mutation.

## The command layer

`src/lib/commands/` gains exactly two verbs, both board operations:

```ts
| { kind: "switch"; target: string }
| { kind: "assign"; target: string; cluster: string }
```

Not `create cluster`, not `ether cluster`. Starting and dissolving a project is
the user's, not an assistant's. `resolve` gains a cluster resolver under the
task rule: ambiguous means refuse, never guess. `list` covers every live cluster
and says which cluster each task is in.

Styling, layout, biomes, the graph, journal and intent stay unreachable, as
before.

## Testing

Tests first, colocated, covering: the array-to-object migration, `clusterId`
repair, catalog-name and placement determinism, ether eligibility,
active-cluster fallback when the active one is ethered, and both new commands.
