import { hash32, unit } from "../hash";
import { decayLevel } from "../orbitalDecay";
import { armSlot, catalogName, deepFieldPlacement } from "./catalog";

/** Re-exported so a view needs one import for the whole map vocabulary. */
export { catalogName as catalogNameFor };
import { isLive, type Cluster } from "./clusters";

/**
 * Andromeda: every project laid out on one spiral, so you can see all of your
 * work at once without opening any of it.
 *
 * Live clusters are points on the arms. Ethered ones sit out past the rim as
 * the galaxies they became. Everything derives from the cluster id, so the map
 * never reshuffles and you learn where your own projects live.
 */

/** How many arms the spiral is drawn with. */
export const ANDROMEDA_ARMS = 4;

/** How far an arm sweeps around between the core and the rim, in radians. */
const ARM_SWEEP = 1.9;

/** Nothing dimmer than this: an abandoned project should still be findable. */
const MIN_BRIGHTNESS = 0.22;

export interface SpiralSlot {
  arm: number;
  /** 0 at the core, 1 at the rim. */
  radius: number;
}

/**
 * How far the disc is tipped away from face-on. Andromeda is seen at a steep
 * angle from here, which is why it reads as an ellipse rather than a pinwheel.
 */
export const DISC_FLATTEN = 0.33;

/** Which way the long axis of that ellipse lies, in radians. */
export const DISC_TILT = -0.42;

/**
 * A point on the flat disc, seen from where we actually stand: turned by the
 * galaxy's own rotation, flattened by the viewing angle, then tipped.
 *
 * Done in numbers rather than as an SVG transform on purpose. Scaling the
 * group would squash every label and turn every round point into an oval; this
 * way only the positions are projected and everything drawn at them stays
 * itself.
 */
export const projectToDisc = (
  point: { x: number; y: number },
  spinDegrees: number
): { x: number; y: number } => {
  const spin = (spinDegrees * Math.PI) / 180;
  const sx = point.x * Math.cos(spin) - point.y * Math.sin(spin);
  const sy = point.x * Math.sin(spin) + point.y * Math.cos(spin);
  const fy = sy * DISC_FLATTEN;
  return {
    x: sx * Math.cos(DISC_TILT) - fy * Math.sin(DISC_TILT),
    y: sx * Math.sin(DISC_TILT) + fy * Math.cos(DISC_TILT),
  };
};

/**
 * Where a neighbouring cluster hangs when you are standing inside one of them
 * and looking out.
 *
 * Spaced by index rather than purely by hash: hashing alone clumps, and a ring
 * of six with two pairs overlapping reads as four. The id only jitters the
 * angle and sets the distance, so the ring never looks like a clock face while
 * a given cluster still lands in the same place every time.
 */
export const ringSlot = (
  clusterId: string,
  index: number,
  total: number
): { angle: number; radius: number } => {
  const span = (Math.PI * 2) / Math.max(1, total);
  const jitter = (unit(hash32(clusterId, 0x51ed270b)) - 0.5) * span * 0.55;
  return {
    angle: index * span + jitter,
    radius: 0.62 + unit(hash32(clusterId, 0x6a09e667)) * 0.33,
  };
};

export interface NeighbourPose {
  /** Depth. Under 1 is further away, over 1 is nearer. */
  scale: number;
  /** Which way the system lies, in radians. */
  tilt: number;
  /** 0.2 (edge-on, a line) to 1 (face-on, a circle). */
  flatten: number;
}

/**
 * How a neighbouring cluster sits in space.
 *
 * Nothing out there shares an orientation or a distance, and a ring of
 * identical face-on systems at identical size reads as a menu rather than a
 * sky. All three come off the id, so a cluster keeps its own bearing forever
 * and none of it is stored.
 */
export const neighbourPose = (clusterId: string): NeighbourPose => ({
  scale: 0.55 + unit(hash32(clusterId, 0x3c6ef372)) * 0.8,
  tilt: unit(hash32(clusterId, 0xa54ff53a)) * Math.PI * 2,
  flatten: 0.22 + unit(hash32(clusterId, 0x510e527f)) * 0.78,
});

export interface AndromedaPoint {
  id: string;
  name: string;
  /** Unit coordinates. Inside the disc is within radius 1. */
  x: number;
  y: number;
  /** 0.22..1, falling as the cluster goes untouched. */
  brightness: number;
  /** 0..1, growing with the work inside. */
  size: number;
  ethered: boolean;
  /** What the sky calls it. Only ethered clusters have one. */
  catalog?: string;
}

/**
 * Where a slot falls on the spiral. The arm turns as it runs outward, which is
 * the whole difference between a spiral and a set of spokes.
 */
export const spiralPoint = ({ arm, radius }: SpiralSlot): { x: number; y: number } => {
  const angle = (arm / ANDROMEDA_ARMS) * Math.PI * 2 + radius * ARM_SWEEP;
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
};

/**
 * The whole map.
 *
 * `lastTouched` and `openCounts` are passed in rather than derived here, so
 * this stays pure and the caller decides what "touched" means. A cluster with
 * neither is treated as fresh and small, which is exactly what a new one is.
 */
export const andromedaPoints = (
  clusters: Cluster[],
  now: number,
  lastTouched: Record<string, number> = {},
  openCounts: Record<string, number> = {}
): AndromedaPoint[] => {
  // Ethered clusters recede in the order they were finished, newest nearest.
  const ordered = clusters
    .filter((cluster) => !isLive(cluster))
    .sort((a, b) => (b.etheredAt ?? 0) - (a.etheredAt ?? 0));
  const rank = new Map(ordered.map((cluster, index) => [cluster.id, index]));

  // Arms are dealt round-robin rather than hashed. Hashing alone put two of
  // three clusters on the same arm at nearly the same radius, and two points
  // on top of each other is one point as far as anyone can tell. The radius
  // still comes off the id, so a cluster keeps its own distance out.
  const liveOrder = new Map(
    clusters.filter(isLive).map((cluster, index) => [cluster.id, index])
  );

  return clusters.map((cluster) => {
    const touched = lastTouched[cluster.id] ?? cluster.createdAt;
    const open = openCounts[cluster.id] ?? 0;
    // Saturating rather than linear: a hundred tasks is a big project, not a
    // point that eats the disc.
    const size = 1 - 1 / (1 + open / 6);

    if (!isLive(cluster)) {
      const placement = deepFieldPlacement(cluster.id, rank.get(cluster.id) ?? 0);
      // Beyond the rim: 1 is the edge of the disc, and a finished galaxy is
      // outside it. Further out means longer ago.
      const distance = 1.25 + (1 - placement.distance) * 1.6;
      return {
        id: cluster.id,
        name: cluster.name,
        x: Math.cos(placement.angle) * distance,
        y: Math.sin(placement.angle) * distance,
        brightness: 0.55,
        size,
        ethered: true,
        catalog: catalogName(cluster.id),
      };
    }

    // Radius is staggered by position as well as hashed, so three clusters
    // spread from the core to the rim instead of landing in one huddle.
    const order = liveOrder.get(cluster.id) ?? 0;
    const liveTotal = Math.max(1, liveOrder.size);
    const band = 0.42 + (order / liveTotal) * 0.5;
    const jitter = (armSlot(cluster.id).radius - 0.65) * 0.16;
    const { x, y } = spiralPoint({
      arm: order % ANDROMEDA_ARMS,
      radius: Math.min(1, Math.max(0.35, band + jitter)),
    });
    // The same curve a neglected task follows, one level up.
    const decay = decayLevel(touched, now);
    return {
      id: cluster.id,
      name: cluster.name,
      x,
      y,
      brightness: MIN_BRIGHTNESS + (1 - MIN_BRIGHTNESS) * (1 - decay),
      size,
      ethered: false,
    };
  });
};
