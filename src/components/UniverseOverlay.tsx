import { useMemo, useState } from "react";
import { catalogNameFor, neighbourPose, ringSlot } from "../lib/clusters/andromeda";
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
        {/* The same warm star the galaxy view puts at the centre of HELIOS. */}
        <radialGradient id="universe-neighbour">
          <stop offset="0%" stopColor="#fffdf3" stopOpacity="1" />
          <stop offset="35%" stopColor="#ffd35c" stopOpacity="0.9" />
          <stop offset="70%" stopColor="#f97316" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
        </radialGradient>
        <filter id="universe-soft" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="0.006" />
        </filter>
      </defs>

      {neighbours.map(({ cluster, angle, radius, ethered }) => {
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        const isHovered = hovered === cluster.id;
        // Depth, bearing and how edge-on it lies -- all off the cluster's id,
        // so the field reads as space rather than a row of identical badges.
        const pose = neighbourPose(cluster.id);
        const size = (ethered ? 0.055 : 0.09) * pose.scale;
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
            <circle r={Math.max(size * 2.4, 0.05)} fill="transparent" />
            {/* The cluster itself, in miniature: the same system the galaxy
                view draws -- a warm star, a ring per column, and one planet per
                task in the colour of the column it stands in. Face-on, like
                HELIOS, not tilted like Andromeda: a neighbour should be
                recognisable as the place you would land in. */}
            <g
              transform={`rotate(${(pose.tilt * 180) / Math.PI})`}
              opacity={ethered ? 0.45 : isHovered ? 1 : 0.85}
            >
              {rings.map((ring) => (
                <ellipse
                  key={ring}
                  rx={size * ring}
                  ry={size * ring * pose.flatten}
                  fill="none"
                  stroke="#e6ad4b"
                  strokeWidth={size * 0.03}
                  opacity={0.32}
                />
              ))}
              {bodies.map((body, i) => (
                <circle
                  key={i}
                  cx={Math.cos(body.angle) * size * body.ring}
                  cy={Math.sin(body.angle) * size * body.ring * pose.flatten}
                  r={size * 0.1}
                  fill={body.color}
                  opacity={body.done ? 1 : 0.85}
                />
              ))}
              <circle r={size * 0.3} fill="url(#universe-neighbour)" />
            </g>
            <text
              y={size * 1.15 + 0.05}
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
                y={size * 1.15 + 0.098}
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
