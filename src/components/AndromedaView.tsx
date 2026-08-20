import { useEffect, useMemo, useRef, useState } from "react";
import {
  DISC_FLATTEN,
  DISC_TILT,
  andromedaPoints,
  projectToDisc,
  type AndromedaPoint,
} from "../lib/clusters/andromeda";
import { hash32, unit } from "../lib/hash";
import andromedaUrl from "../assets/andromeda.jpg";
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
const DISC_EXTENT = 1.02;

/**
 * Half-width the photograph is drawn at. Its disc runs to about 0.95 of the
 * frame, so this puts the visible galaxy at radius ~1 -- where the cluster
 * points are placed, which is what makes them land on the arms rather than
 * beside them.
 */
const PHOTO_HALF = 1.06;
const DEEP_FIELD_EXTENT = 3;

/** Arms drawn, and how far each sweeps. Many, tight, and unevenly lit. */
const DRAWN_ARMS = 22;
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
const DUST = Array.from({ length: 620 }, (_, i) => {
  const seed = `dust-${i}`;
  const angle = unit(hash32(seed, 0x1111)) * Math.PI * 2;
  // Square-rooted so the speckle spreads evenly rather than crowding the core.
  const radius = 0.2 + Math.sqrt(unit(hash32(seed, 0x2222))) * 1.0;
  // Pink is rare and scattered. Making it common at large radius drew a solid
  // red rim, which is the one thing the real photograph does not have -- its
  // outer disc is blue, with pink knots dotted through it.
  const young = radius > 0.55 && unit(hash32(seed, 0x5555)) > 0.9;
  return {
    angle,
    radius,
    size: 0.003 + unit(hash32(seed, 0x3333)) * (young ? 0.008 : 0.005),
    opacity: (young ? 0.35 : 0.12) + unit(hash32(seed, 0x4444)) * 0.45,
    color: young ? "#ff9ecb" : radius > 0.55 ? "#a8c4ff" : "#f3e3c6",
  };
});

/**
 * The dark bands cut across the disc. Deliberately not concentric: the
 * near-side lane sits off centre, which is what gives Andromeda its depth
 * rather than reading as a flat pinwheel.
 */
interface DustLane {
  rx: number;
  cx: number;
  cy: number;
  width: number;
  opacity: number;
  /** Where the band starts and stops, in radians. */
  from: number;
  to: number;
}

const DUST_LANES: DustLane[] = [
  { rx: 1.14, cx: 0.0, cy: -0.02, width: 0.034, opacity: 0.4, from: 0.35, to: 3.4 },
  { rx: 1.02, cx: 0.03, cy: -0.05, width: 0.05, opacity: 0.6, from: -0.4, to: 3.2 },
  { rx: 0.9, cx: -0.01, cy: -0.06, width: 0.045, opacity: 0.55, from: 2.7, to: 6.2 },
  { rx: 0.76, cx: 0.03, cy: -0.06, width: 0.038, opacity: 0.46, from: 0.1, to: 3.0 },
  { rx: 0.6, cx: 0.04, cy: -0.05, width: 0.03, opacity: 0.36, from: 3.0, to: 5.9 },
];

/**
 * A dust band as an open arc rather than a closed ellipse. A ring reads as an
 * outline drawn around the galaxy; a band that starts and stops reads as dust
 * passing in front of the bulge, which is what it is.
 */
const laneArc = ({ rx, cx, cy, from, to }: DustLane): string => {
  const ry = rx * DISC_FLATTEN;
  const steps = 40;
  let path = "";
  for (let i = 0; i <= steps; i += 1) {
    const angle = from + ((to - from) * i) / steps;
    const x = cx + Math.cos(angle) * rx;
    const y = cy + Math.sin(angle) * ry;
    path += `${i === 0 ? "M" : "L"}${x.toFixed(4)},${y.toFixed(4)}`;
  }
  return path;
};

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
  // Falls back to the drawn galaxy if the file ever goes missing.
  const [photoOk, setPhotoOk] = useState(true);
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
            {/* Layered on purpose: a white-hot nucleus, a warm bulge, a beige
                halo, then the cool disc. Warm at the middle, cool at the rim
                is most of what makes a galaxy read as photographed. */}
            <radialGradient id="andromeda-nucleus">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
              <stop offset="55%" stopColor="#fff6e2" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#ffe9c0" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="andromeda-bulge">
              <stop offset="0%" stopColor="#fffaef" stopOpacity="0.98" />
              <stop offset="22%" stopColor="#ffeed2" stopOpacity="0.8" />
              <stop offset="55%" stopColor="#eccfa2" stopOpacity="0.34" />
              <stop offset="100%" stopColor="#d0ad82" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="andromeda-disc">
              <stop offset="0%" stopColor="#f6e6c8" stopOpacity="0.26" />
              <stop offset="34%" stopColor="#c6cfe6" stopOpacity="0.22" />
              <stop offset="68%" stopColor="#93a6cd" stopOpacity="0.17" />
              <stop offset="90%" stopColor="#7186b4" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#5d719c" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="andromeda-companion">
              <stop offset="0%" stopColor="#fffaf0" stopOpacity="0.95" />
              <stop offset="40%" stopColor="#e8dcc4" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#c9b89a" stopOpacity="0" />
            </radialGradient>
            <filter id="andromeda-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="0.02" />
            </filter>
            <filter id="andromeda-lane" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="0.026" />
            </filter>
            <filter id="andromeda-companion-soft" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="0.012" />
            </filter>
            {/* The photograph is a square, and a square has corners. Feathered
                out, it stops being a picture pasted on the page and becomes
                the sky the panel is looking at. */}
            <radialGradient id="andromeda-vignette">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
              <stop offset="52%" stopColor="#ffffff" stopOpacity="1" />
              <stop offset="78%" stopColor="#ffffff" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </radialGradient>
            <mask id="andromeda-mask">
              <rect
                x={-PHOTO_HALF}
                y={-PHOTO_HALF}
                width={PHOTO_HALF * 2}
                height={PHOTO_HALF * 2}
                fill="url(#andromeda-vignette)"
              />
            </mask>
          </defs>

          {/* The photograph when it loads, the drawn galaxy when it does
              not. Still, deliberately: a real photo rotated in two
              dimensions reads as a spinning plate, not a turning galaxy.
              The clusters keep orbiting over it, which is the motion that
              was ever true. */}
          {photoOk ? (
            <image
              href={andromedaUrl}
              x={-PHOTO_HALF}
              y={-PHOTO_HALF}
              width={PHOTO_HALF * 2}
              height={PHOTO_HALF * 2}
              preserveAspectRatio="xMidYMid slice"
              mask="url(#andromeda-mask)"
              onError={() => setPhotoOk(false)}
            />
          ) : (
            <>

            {/* Subtle, so the galaxy dominates rather than competes. */}
            <g opacity={0.7}>
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

            <g transform={`rotate(${TILT_DEGREES})`}>
              <ellipse rx={1.5} ry={1.5 * DISC_FLATTEN} fill="url(#andromeda-disc)" />
            </g>

            {/* The star-filled haze of the disc, built from many faint arms.
                Blurred, they read as light rather than line work. */}
            <g filter="url(#andromeda-soft)">
              {Array.from({ length: DRAWN_ARMS }, (_, arm) => (
                <path
                  key={`arm-${arm}`}
                  d={armPath(arm, spin)}
                  fill="none"
                  stroke={arm % 5 === 0 ? "#e2e8ff" : "#9fb0dd"}
                  strokeWidth={0.01 + (arm % 3) * 0.004}
                  strokeLinecap="round"
                  opacity={0.08 + (arm % 5) * 0.03}
                />
              ))}
            </g>

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

            {/* Arcs, not rings. A closed ellipse reads as an outline drawn round
                the galaxy; a band that starts and stops reads as dust passing in
                front of the bulge, which is what it is. */}
            <g transform={`rotate(${TILT_DEGREES})`} filter="url(#andromeda-lane)">
              {DUST_LANES.map((lane, i) => (
                <path
                  key={`lane-${i}`}
                  d={laneArc(lane)}
                  fill="none"
                  stroke="#241a12"
                  strokeWidth={lane.width}
                  strokeLinecap="round"
                  opacity={lane.opacity}
                />
              ))}
            </g>

            <g transform={`rotate(${TILT_DEGREES})`}>
              <ellipse rx={0.54} ry={0.54 * DISC_FLATTEN * 1.7} fill="url(#andromeda-bulge)" />
              <ellipse rx={0.15} ry={0.15 * DISC_FLATTEN * 2.4} fill="url(#andromeda-nucleus)" />
            </g>

            {/* M32 and M110. Nothing else says Andromeda as quickly. */}
            <g filter="url(#andromeda-companion-soft)">
              <ellipse
                cx={0.72}
                cy={-0.66}
                rx={0.075}
                ry={0.06}
                fill="url(#andromeda-companion)"
              />
              <ellipse
                cx={-0.86}
                cy={0.52}
                rx={0.15}
                ry={0.085}
                transform="rotate(-18 -0.86 0.52)"
                fill="url(#andromeda-companion)"
                opacity={0.72}
              />
            </g>

            </>
          )}

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
          {/* Which one you are standing in. The ring on its point says so too,
              but only if you can find the point. */}
          <p className="mt-1.5 truncate text-sm text-[#c9d0ff]">
            {live.find((point) => point.id === activeClusterId)?.name ?? "Nowhere yet"}
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
