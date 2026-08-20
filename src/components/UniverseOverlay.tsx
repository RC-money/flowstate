import { useMemo, useState } from "react";
import {
  DISC_FLATTEN,
  DISC_TILT,
  catalogNameFor,
  ringSlot,
} from "../lib/clusters/andromeda";
import { isLive, type Cluster } from "../lib/clusters/clusters";

interface UniverseOverlayProps {
  clusters: Cluster[];
  activeClusterId: string | null;
  totalCounts: Record<string, number>;
  onEnter: (id: string) => void;
}

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
      preserveAspectRatio="xMidYMid slice"
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-label="The rest of the universe"
    >
      <defs>
        <radialGradient id="universe-neighbour">
          <stop offset="0%" stopColor="#fff4dc" stopOpacity="0.95" />
          <stop offset="40%" stopColor="#c9d0ff" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#7c83ff" stopOpacity="0" />
        </radialGradient>
      </defs>

      {neighbours.map(({ cluster, angle, radius, ethered }) => {
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        const isHovered = hovered === cluster.id;
        const size = ethered ? 0.045 : 0.075;
        const total = totalCounts[cluster.id] ?? 0;
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
            <circle r={size * 2.2} fill="transparent" />
            <g transform={`rotate(${TILT_DEGREES})`}>
              <ellipse
                rx={size}
                ry={size * DISC_FLATTEN}
                fill="url(#universe-neighbour)"
                opacity={ethered ? 0.45 : isHovered ? 1 : 0.75}
              />
              <ellipse
                rx={size * 0.28}
                ry={size * 0.28 * DISC_FLATTEN * 1.6}
                fill="#fffaf0"
                opacity={ethered ? 0.5 : 0.9}
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
