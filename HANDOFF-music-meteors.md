# Handoff: music mixer, orbit pianos, meteor showers → merge to main

For the session merging Galaxy into main. Written 2026-08-19 by the
music-feature session. This file is untracked on purpose — don't commit it.

## What to merge

Everything is committed on `Galaxy` and pushed to `origin/Galaxy`. Three
commits carry the music work; the first two are **already on origin/main**
(pushed earlier at Ricardo's request), so only the last one is pending:

- `6fcda54` Music panel in the Observatory: two Orbit tracks, one at a time — *already on main*
- `878b368` Music panel becomes a little mixer: play symbols, shuffle, loop-one — *already on main*
- `f11afa1` A piano in every orbit, and meteors when the music swells — **pending merge**

`origin/main` fast-forwards from `878b368`. No merge conflicts expected from
my side: `f11afa1` was staged hunk-by-hunk to exclude the celestial work in
the shared working tree.

## What the features are

- **MusicPanel** ([src/components/MusicPanel.tsx](src/components/MusicPanel.tsx)) — lives in the Observatory
  drawer. Two tracks (Orbit I/II, mp3s in `src/assets/`). Picking a song
  loops it; Shuffle keeps songs going (random next track on `ended`).
- **PianoStrip** ([src/components/PianoStrip.tsx](src/components/PianoStrip.tsx)) — the ♪ button on each track
  row pulls out a G4–G5 piano across the container. Keys synthesize real
  pitches (`usePianoSynth`, lazy AudioContext); the track's melody notes
  glow on the keys. Melody data sits on `MUSIC_TRACKS` in App.tsx.
- **MeteorShower** ([src/components/MeteorShower.tsx](src/components/MeteorShower.tsx)) — canvas next to
  AmbientStars, idle until a `flowstate:meteor-shower` CustomEvent.
  `useAmbientAudio` fires that event from an AnalyserNode watching the
  playing track for swells (RMS surge over an EMA baseline, 8s cooldown,
  silence never fires — see `src/lib/swell.ts`). Only fires while music
  actually plays. Honors prefers-reduced-motion.
- Pure logic + tests: `src/lib/notes.ts`, `src/lib/swell.ts`,
  `src/lib/shuffle.ts` (all with colocated `*.test.ts`).

## Verified

- `npm run build`, `npm test` (312 passing at commit time), lint (0 errors,
  16 pre-existing warnings).
- In-browser: panel renders, shuffle/loop states flip, piano pulls out with
  melody dots, a real swell in Orbit I fired one shower in ~20s of playback,
  and the meteor canvas draws (pixel-sampled mid-shower).

## Boundaries honored

- Music/piano/meteors are UI-only. **Nothing was added to `src/lib/commands/`**
  — the MCP surface still exposes board operations only.
- The two ⌘K palette commands from an early iteration were removed when the
  panel replaced them; the palette is unchanged from main's perspective
  except for nothing — check `commands` in App.tsx if in doubt.

## Not mine — don't attribute to this branch's music work

Uncommitted in the shared tree when I finished: the celestial work
(CelestialPanel, NovaStar, useCelestialPrefs, celestialPrefs/celestialStore,
orbitalMechanics, edits to Column/TaskCard/TaskModal/graphStyles, and the
`CelestialPanel` import + mount hunks in App.tsx) plus
docs/GUMROAD_LISTING.md. That's the other session's in-flight work — it had
live console errors (`NovaStar: color is not defined`) at the time of
writing, so make sure it's finished before it rides along into main.
