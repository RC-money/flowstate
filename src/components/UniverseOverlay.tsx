import { useMemo, useState } from "react";
import {
  DISC_FLATTEN,
  DISC_TILT,
  catalogNameFor,
  ringSlot,
} from "../lib/clusters/andromeda";
import { isLive, type Cluster } from "../lib/clusters/clusters";
import { columnPalette } from "../lib/columns/palette";
import type { Task } from "../hooks/useLocalTasks";

interface UniverseOverlayProps {
  clusters: Cluster[];
  activeClusterId: string | null;
  totalCounts: Record<string, number>;
  /** The real contents of each cluster, so a neighbour shows its own work. */
  tasksByCluster: Record<string, Task[]>;
  onEnter: (id: string) => void;
}

/**
 * How many of a cluster's tasks are actually drawn. Past this the system turns
 * to mush and the count under the name says it better than more dots would.
 */
const MAX_BODIES = 14;

const TILT_DEGREES = (DISC_TILT * 180) / Math.PI;

/**
 * The rest of the universe, seen from inside one galaxy.
 *
 * Drawn as its own layer over the graph rather than inside it: GraphView owns
 * a canvas and a physics simulation, and neighbouring galaxies are neither
 * nodes nor forces. Keeping them apart means this can be switched off with no
 * cost to what is underneath.
 *
 * Live clusters ring the view as small spirals. Ethered ones sit further out,
 * dimmer, under their catalogue names -- the same distinction Andromeda makes.
 */
export default function UniverseOverlay({
  clusters,
  activeClusterId,
  totalCounts,
  tasksByCluster,
  onEnter,
}: UniverseOverlayProps) {
  const [hovered, setHovered] = useState<string | null>(null);

  const neighbours = useMemo(() => {
    const others = clusters.filter((cluster) => cluster.id !== activeClusterId);
    const live = others.filter(isLive);
    const gone = others.filter((cluster) => !isLive(cluster));
    return [
      ...live.map((cluster, index) => ({
        cluster,
        ...ringSlot(cluster.id, index, live.length),
        ethered: false,
      })),
      // Finished galaxies sit outside the ring of live ones, pushed out by the
      // same fraction that keeps them clear of the working view.
      ...gone.map((cluster, index) => {
        const slot = ringSlot(cluster.id, index, Math.max(1, gone.length));
        return { cluster, angle: slot.angle, radius: 1.02, ethered: true };
      }),
    ];
  }, [clusters, activeClusterId]);

  if (!neighbours.length) return null;

  return (
    <svg
      viewBox="-1.2 -1.2 2.4 2.4"
      preserveAspectRatio="xMidYMid meet"
      className="pointer-events-none absolute inset-0 z-20 h-full w-full"
      aria-label="The rest of the universe"
    >
      <defs>
        <radialGradient id="universe-neighbour">
          <stop offset="0%" stopColor="#fff6e4" stopOpacity="0.85" />
          <stop offset="26%" stopColor="#e6d5bb" stopOpacity="0.42" />
          <stop offset="62%" stopColor="#aab6ea" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#7c83ff" stopOpacity="0" />
        </radialGradient>
        <filter id="universe-soft" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="0.006" />
        </filter>
      </defs>

      {neighbours.map(({ cluster, angle, radius, ethered }) => {
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        const isHovered = hovered === cluster.id;
        const size = ethered ? 0.055 : 0.09;
        const total = totalCounts[cluster.id] ?? 0;
        // One body per task, on the ring its column stands in -- the same
        // reading the full galaxy gives, just small enough to glance at.
        const members = (tasksByCluster[cluster.id] ?? []).slice(0, MAX_BODIES);
        const columnCount = Math.max(1, cluster.columns.length);
        const bodies = members.map((task, i) => {
          const columnIndex = Math.max(
            0,
            cluster.columns.findIndex((column) => column.id === task.status)
          );
          return {
            angle: (i / Math.max(1, members.length)) * Math.PI * 2 + columnIndex,
            ring: 0.45 + (columnIndex / columnCount) * 0.8,
            color: columnPalette(columnIndex).core,
            done: columnIndex === columnCount - 1,
          };
        });
        const rings = Array.from(
          new Set(bodies.map((body) => Number(body.ring.toFixed(3))))
        );
        return (
          <g
            key={cluster.id}
            transform={`translate(${x} ${y})`}
            className="pointer-events-auto"
            style={{ cursor: "pointer" }}
            onMouseEnter={() => setHovered(cluster.id)}
            onMouseLeave={() => setHovered((prev) => (prev === cluster.id ? null : prev))}
            onClick={() => onEnter(cluster.id)}
          >
            <circle r={size * 2.4} fill="transparent" />
            {/* The cluster itself, in miniature: its own sun, its own rings,
                and one body per task in the colour of the column it stands in.
                A neighbour is a place you recognise, not a generic smudge. */}
            <g
              transform={`rotate(${TILT_DEGREES})`}
              opacity={ethered ? 0.45 : isHovered ? 1 : 0.8}
            >
              <ellipse
                rx={size * 1.35}
                ry={size * 1.35 * DISC_FLATTEN}
                fill="url(#universe-neighbour)"
              />
              {rings.map((ring) => (
                <ellipse
                  key={ring}
                  rx={size * ring}
                  ry={size * ring * DISC_FLATTEN}
                  fill="none"
                  stroke="#c9d0ff"
                  strokeWidth={size * 0.035}
                  opacity={0.22}
                />
              ))}
              {bodies.map((body, i) => (
                <circle
                  key={i}
                  cx={Math.cos(body.angle) * size * body.ring}
                  cy={Math.sin(body.angle) * size * body.ring * DISC_FLATTEN}
                  r={size * 0.11}
                  fill={body.color}
                  opacity={body.done ? 0.95 : 0.8}
                />
              ))}
              <ellipse
                rx={size * 0.2}
                ry={size * 0.2 * DISC_FLATTEN * 2.4}
                fill="#fff3d8"
                opacity={ethered ? 0.6 : 1}
              />
            </g>
            <text
              y={size * DISC_FLATTEN + 0.075}
              textAnchor="middle"
              fill={ethered ? "#8892b0" : "#c9d0ff"}
              opacity={isHovered ? 1 : 0.7}
              style={{
                fontSize: 0.042,
                fontFamily: "ui-monospace, monospace",
                letterSpacing: 0.002,
              }}
            >
              {ethered ? catalogNameFor(cluster.id) : cluster.name}
            </text>
            {isHovered && !ethered ? (
              <text
                y={size * DISC_FLATTEN + 0.128}
                textAnchor="middle"
                fill="#6d7899"
                style={{ fontSize: 0.034, fontFamily: "ui-monospace, monospace" }}
              >
                {total} {total === 1 ? "task" : "tasks"}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}
