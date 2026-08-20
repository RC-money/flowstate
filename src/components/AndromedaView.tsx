import { useEffect, useMemo, useRef, useState } from "react";
import {
  DISC_FLATTEN,
  DISC_TILT,
  andromedaPoints,
  projectToDisc,
  type AndromedaPoint,
} from "../lib/clusters/andromeda";
import { hash32, unit } from "../lib/hash";
import type { Cluster } from "../lib/clusters/clusters";

interface AndromedaViewProps {
  clusters: Cluster[];
  activeClusterId: string | null;
  /** Last time anything in each cluster changed. Dims the points. */
  lastTouched: Record<string, number>;
  /** Everything in each cluster, finished or not. */
  totalCounts: Record<string, number>;
  openCounts: Record<string, number>;
  /** Dive into a cluster: make it active and fall back to the board. */
  onEnter: (id: string) => void;
  onCreate: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onEther: (id: string) => void;
  onDelete: (id: string) => void;
  canEther: (id: string) => boolean;
  /** Open with the naming field already up, for the palette's "New cluster". */
  startNaming?: boolean;
  onClose: () => void;
}

/** How long one turn of the galaxy takes. Slow enough to read as alive. */
const ROTATION_MS = 110_000;

/**
 * Half-width of the drawing surface. The disc alone needs very little room;
 * the extra is only for the deep field, so a board with nothing ethered yet
 * gets a galaxy that fills the space instead of a speck in a wide empty frame.
 */
const DISC_EXTENT = 1.35;
const DEEP_FIELD_EXTENT = 3;

/** Arms drawn, and how far each sweeps. Many, tight, and unevenly lit. */
const DRAWN_ARMS = 16;
const ARM_WINDINGS = 2.4;

const prefersReducedMotion = (): boolean =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * One arm as a projected path. A logarithmic spiral sampled finely, each
 * sample run through the same projection the points use, so the arms and the
 * clusters standing on them agree about where the disc is.
 */
const armPath = (arm: number, spin: number, offset = 0): string => {
  const steps = 60;
  let path = "";
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const radius = 0.16 + t * 0.94;
    const angle =
      (arm / DRAWN_ARMS) * Math.PI * 2 + t * ARM_WINDINGS + offset;
    const flat = { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
    const { x, y } = projectToDisc(flat, spin);
    path += `${i === 0 ? "M" : "L"}${x.toFixed(4)},${y.toFixed(4)}`;
  }
  return path;
};

/** The tilt, in degrees, for the parts drawn as ellipses rather than points. */
const TILT_DEGREES = (DISC_TILT * 180) / Math.PI;

/**
 * Star-forming knots across the disc, fixed by index so they never boil
 * between frames. Pink where the arms are young, blue-white nearer the core --
 * the two colours the real thing is made of.
 */
const DUST = Array.from({ length: 520 }, (_, i) => {
  const seed = `dust-${i}`;
  const angle = unit(hash32(seed, 0x1111)) * Math.PI * 2;
  // Square-rooted so the speckle spreads evenly rather than crowding the core.
  const radius = 0.2 + Math.sqrt(unit(hash32(seed, 0x2222))) * 1.0;
  const young = radius > 0.62 && unit(hash32(seed, 0x5555)) > 0.62;
  return {
    angle,
    radius,
    size: 0.0035 + unit(hash32(seed, 0x3333)) * (young ? 0.009 : 0.005),
    opacity: 0.14 + unit(hash32(seed, 0x4444)) * 0.5,
    color: young ? "#ff9ecb" : radius > 0.5 ? "#bcd0ff" : "#f6e9d2",
  };
});

/**
 * The dark bands cut across the disc. Deliberately not concentric: the
 * near-side lane sits off centre, which is what gives Andromeda its depth
 * rather than reading as a flat pinwheel.
 */
const DUST_LANES = [
  { rx: 1.04, cx: 0.03, cy: -0.05, width: 0.055, opacity: 0.5 },
  { rx: 0.86, cx: -0.02, cy: -0.07, width: 0.045, opacity: 0.42 },
  { rx: 0.68, cx: 0.04, cy: -0.05, width: 0.036, opacity: 0.34 },
  { rx: 1.19, cx: 0.0, cy: -0.03, width: 0.04, opacity: 0.3 },
];

/** The field the galaxy hangs in. Unit square, scaled to whatever extent. */
const FIELD = Array.from({ length: 260 }, (_, i) => {
  const seed = `field-${i}`;
  const bright = unit(hash32(seed, 0x7777));
  return {
    x: unit(hash32(seed, 0x6161)) * 2 - 1,
    y: unit(hash32(seed, 0x6262)) * 2 - 1,
    size: 0.003 + bright * 0.006,
    opacity: 0.12 + bright * 0.55,
    color: bright > 0.93 ? "#ffd9b0" : bright > 0.8 ? "#cfe0ff" : "#ffffff",
  };
});

export default function AndromedaView({
  clusters,
  activeClusterId,
  lastTouched,
  totalCounts,
  openCounts,
  onEnter,
  onCreate,
  onRename,
  onEther,
  onDelete,
  canEther,
  startNaming = false,
  onClose,
}: AndromedaViewProps) {
  const [spin, setSpin] = useState(0);
  const [hovered, setHovered] = useState<string | null>(null);
  const [showDeepField, setShowDeepField] = useState(true);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(startNaming);
  const [newName, setNewName] = useState("");
  const frame = useRef<number | null>(null);
  const pausedRef = useRef(false);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    let previous: number | null = null;
    const step = (time: number) => {
      const delta = previous === null ? 0 : time - previous;
      previous = time;
      // Held still while the pointer is over the galaxy: a point you are
      // reaching for should not drift out from under the cursor.
      if (!pausedRef.current) {
        setSpin((prev) => (prev + (delta / ROTATION_MS) * 360) % 360);
      }
      frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !renamingId && !adding) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, renamingId, adding]);

  const points = useMemo(
    () => andromedaPoints(clusters, Date.now(), lastTouched, openCounts),
    [clusters, lastTouched, openCounts]
  );

  const live = points.filter((point) => !point.ethered);
  const deep = points.filter((point) => point.ethered);
  const shown = showDeepField ? points : live;
  const extent = showDeepField && deep.length ? DEEP_FIELD_EXTENT : DISC_EXTENT;

  const commitRename = () => {
    if (renamingId) onRename(renamingId, draft);
    setRenamingId(null);
    setDraft("");
  };

  const commitAdd = () => {
    const name = newName.trim();
    if (name) onCreate(name);
    setNewName("");
    setAdding(false);
  };

  const renderPoint = (point: AndromedaPoint) => {
    const isActive = point.id === activeClusterId;
    const isHovered = point.id === hovered;
    const radius = 0.028 + point.size * 0.038;
    // Ethered galaxies sit outside the disc, so they are not on its plane and
    // do not get its projection.
    const at = point.ethered ? point : projectToDisc(point, spin);
    return (
      <g
        key={point.id}
        transform={`translate(${at.x} ${at.y})`}
        onMouseEnter={() => setHovered(point.id)}
        onMouseLeave={() => setHovered((prev) => (prev === point.id ? null : prev))}
        onClick={() => onEnter(point.id)}
        style={{ cursor: "pointer" }}
      >
        {/* A generous invisible target: the visible point is small by design,
            and hunting a six-pixel dot is not the feeling here. */}
        <circle r={Math.max(radius * 4, 0.1)} fill="transparent" />
        <circle
          r={radius * (isHovered || isActive ? 3.4 : 2.4)}
          fill={point.ethered ? "#c9d0ff" : "#ffffff"}
          opacity={point.brightness * 0.2}
        />
        <circle
          r={radius}
          fill={point.ethered ? "#c9d0ff" : "#ffffff"}
          opacity={Math.min(1, point.brightness + 0.15)}
        />
        {isActive ? (
          <circle
            r={radius * 3.2}
            fill="none"
            stroke="#7c83ff"
            strokeWidth={0.009}
            opacity={0.95}
          />
        ) : null}
        {isHovered || isActive ? (
          <text
            y={radius * 3.4 + 0.085}
            textAnchor="middle"
            fill={point.ethered ? "#9aa6c4" : "#e7ebff"}
            style={{
              fontSize: 0.075,
              fontFamily: "ui-monospace, monospace",
              letterSpacing: 0.004,
            }}
          >
            {point.ethered ? point.catalog : point.name}
          </text>
        ) : null}
      </g>
    );
  };

  return (
    <div className="fixed inset-0 z-[9997] flex bg-[#04060f]">
      <div className="relative flex-1">
        <svg
          viewBox={`${-extent} ${-extent} ${extent * 2} ${extent * 2}`}
          className="h-full w-full"
          role="img"
          aria-label="Andromeda: every cluster as a point"
          onMouseEnter={() => {
            pausedRef.current = true;
          }}
          onMouseLeave={() => {
            pausedRef.current = false;
          }}
        >
          <defs>
            <radialGradient id="andromeda-bulge">
              <stop offset="0%" stopColor="#fffdf6" stopOpacity="1" />
              <stop offset="14%" stopColor="#fff2d8" stopOpacity="0.92" />
              <stop offset="38%" stopColor="#f0d7ac" stopOpacity="0.55" />
              <stop offset="70%" stopColor="#d8bb91" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#c9a882" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="andromeda-disc">
              <stop offset="0%" stopColor="#e8ecff" stopOpacity="0.42" />
              <stop offset="45%" stopColor="#b8c4f0" stopOpacity="0.22" />
              <stop offset="78%" stopColor="#8f9fd8" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#6b7bb8" stopOpacity="0" />
            </radialGradient>
            <filter id="andromeda-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="0.022" />
            </filter>
            <filter id="andromeda-lane" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="0.014" />
            </filter>
          </defs>

          {/* The field this galaxy hangs in. Fixed, so it never boils. */}
          <g>
            {FIELD.map((star, i) => (
              <circle
                key={`f${i}`}
                cx={star.x * extent}
                cy={star.y * extent}
                r={star.size}
                fill={star.color}
                opacity={star.opacity}
              />
            ))}
          </g>

          {/* Everything below shares one tilt, so the disc, its lanes and its
              bulge are the same ellipse seen at the same angle. */}
          <g transform={`rotate(${TILT_DEGREES})`}>
            <ellipse rx={1.3} ry={1.3 * DISC_FLATTEN} fill="url(#andromeda-disc)" />
          </g>

          {/* The luminous disc, built from many faint arms rather than a few
              drawn ones. Blurred, they read as light instead of line work. */}
          <g filter="url(#andromeda-soft)">
            {Array.from({ length: DRAWN_ARMS }, (_, arm) => (
              <path
                key={`arm-${arm}`}
                d={armPath(arm, spin)}
                fill="none"
                stroke={arm % 5 === 0 ? "#dfe7ff" : "#aebbe8"}
                strokeWidth={0.012 + (arm % 3) * 0.005}
                strokeLinecap="round"
                opacity={0.1 + (arm % 5) * 0.035}
              />
            ))}
          </g>

          {/* Dust: the dark bands that make Andromeda read as Andromeda. Not
              concentric -- the near-side lane sits off centre, which is what
              gives the disc its depth. */}
          <g transform={`rotate(${TILT_DEGREES})`} filter="url(#andromeda-lane)">
            {DUST_LANES.map((lane, i) => (
              <ellipse
                key={`lane-${i}`}
                rx={lane.rx}
                ry={lane.rx * DISC_FLATTEN}
                cx={lane.cx}
                cy={lane.cy}
                fill="none"
                stroke="#0c0906"
                strokeWidth={lane.width}
                opacity={lane.opacity}
              />
            ))}
          </g>

          {/* Star-forming knots, blue and pink, out where the arms are young. */}
          <g filter="url(#andromeda-soft)">
            {DUST.map((speck, i) => {
              const flat = {
                x: Math.cos(speck.angle) * speck.radius,
                y: Math.sin(speck.angle) * speck.radius,
              };
              const { x, y } = projectToDisc(flat, spin);
              return (
                <circle
                  key={i}
                  cx={x}
                  cy={y}
                  r={speck.size}
                  fill={speck.color}
                  opacity={speck.opacity}
                />
              );
            })}
          </g>

          <g transform={`rotate(${TILT_DEGREES})`}>
            <ellipse rx={0.62} ry={0.62 * DISC_FLATTEN * 1.5} fill="url(#andromeda-bulge)" />
          </g>

          {shown.map(renderPoint)}
        </svg>

        <button
          type="button"
          onClick={onClose}
          className="absolute left-5 top-5 rounded-xl border border-[rgba(165,175,255,0.14)] px-3 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.09em] text-[#9aa6c4] transition hover:border-[rgba(165,175,255,0.4)] hover:text-white"
        >
          &larr; Back
        </button>
      </div>

      <aside className="flex w-[300px] shrink-0 flex-col border-l border-[rgba(165,175,255,0.1)] bg-[rgba(9,10,25,0.72)]">
        <header className="border-b border-[rgba(165,175,255,0.1)] px-5 py-4">
          <p className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-slate-300">
            Andromeda
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {live.length} {live.length === 1 ? "cluster" : "clusters"} on the arms
            {deep.length ? `, ${deep.length} out in the deep field` : ""}.
          </p>
        </header>

        <div className="flex-1 overflow-y-auto px-3 py-3">
          {live.map((point) => {
            const isActive = point.id === activeClusterId;
            const total = totalCounts[point.id] ?? 0;
            const open = openCounts[point.id] ?? 0;
            return (
              <div
                key={point.id}
                onMouseEnter={() => setHovered(point.id)}
                onMouseLeave={() => setHovered((prev) => (prev === point.id ? null : prev))}
                className={`mb-1 rounded-xl px-3 py-2 transition ${
                  isActive || hovered === point.id
                    ? "bg-[rgba(124,131,255,0.13)]"
                    : "hover:bg-white/[0.04]"
                }`}
              >
                {renamingId === point.id ? (
                  <input
                    autoFocus
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onBlur={commitRename}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") commitRename();
                      if (event.key === "Escape") setRenamingId(null);
                    }}
                    aria-label={`Rename ${point.name}`}
                    className="w-full bg-transparent text-sm text-white outline-none"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => onEnter(point.id)}
                    className="w-full truncate text-left text-sm text-[#e7ebff]"
                  >
                    {point.name}
                  </button>
                )}
                <p className="mt-0.5 font-mono text-[10px] tabular-nums text-[#6d7899]">
                  {total} {total === 1 ? "task" : "tasks"}
                  {open ? ` · ${open} open` : total ? " · all done" : ""}
                </p>
                <div className="mt-1 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setDraft(point.name);
                      setRenamingId(point.id);
                    }}
                    className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-[#4d587a] transition hover:text-[#c9d0ff]"
                  >
                    Rename
                  </button>
                  {canEther(point.id) ? (
                    <button
                      type="button"
                      onClick={() => onEther(point.id)}
                      className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-[#4d587a] transition hover:text-[#c9d0ff]"
                    >
                      Send to the ether
                    </button>
                  ) : null}
                  {/* Only an empty one. Ethering is how finished work leaves;
                      this is only for a cluster started by mistake. */}
                  {total === 0 && live.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => onDelete(point.id)}
                      className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-[#4d587a] transition hover:text-[#ff9a9a]"
                    >
                      Delete
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}

          {deep.length ? (
            <div className="mt-4 border-t border-[rgba(165,175,255,0.1)] pt-3">
              <button
                type="button"
                onClick={() => setShowDeepField((prev) => !prev)}
                aria-pressed={showDeepField}
                className="mb-2 w-full px-3 text-left font-mono text-[9.5px] uppercase tracking-[0.12em] text-[#4d587a] transition hover:text-[#c9d0ff]"
              >
                Deep field &middot; {showDeepField ? "shown" : "hidden"}
              </button>
              {showDeepField
                ? deep.map((point) => (
                    <div
                      key={point.id}
                      onMouseEnter={() => setHovered(point.id)}
                      onMouseLeave={() =>
                        setHovered((prev) => (prev === point.id ? null : prev))
                      }
                      className="mb-1 rounded-xl px-3 py-2 hover:bg-white/[0.04]"
                    >
                      <p className="truncate text-sm text-[#9aa6c4]">{point.name}</p>
                      <p className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-[#4d587a]">
                        {point.catalog} &middot; {totalCounts[point.id] ?? 0} tasks
                      </p>
                    </div>
                  ))
                : null}
            </div>
          ) : null}
        </div>

        <footer className="border-t border-[rgba(165,175,255,0.1)] p-3">
          {adding ? (
            <input
              autoFocus
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              onBlur={commitAdd}
              onKeyDown={(event) => {
                if (event.key === "Enter") commitAdd();
                if (event.key === "Escape") {
                  setNewName("");
                  setAdding(false);
                }
              }}
              placeholder="Name it"
              aria-label="Name the new cluster"
              className="w-full rounded-xl border border-[rgba(165,175,255,0.2)] bg-[rgba(165,175,255,0.06)] px-3 py-2 text-sm text-white outline-none placeholder:text-[#6b7799]"
            />
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="w-full rounded-xl border border-dashed border-[rgba(165,175,255,0.16)] px-3 py-2 font-mono text-[10.5px] font-semibold uppercase tracking-[0.09em] text-[#9aa6c4] transition hover:border-[rgba(165,175,255,0.4)] hover:text-white"
            >
              + New cluster
            </button>
          )}
        </footer>
      </aside>
    </div>
  );
}
