import { hash32, unit } from "../hash";

/**
 * Where a cluster sits in the sky, and what the sky calls it.
 *
 * Everything here derives from the cluster id, the same promise the earned
 * stars make: nothing is stored, so a designation survives export, import and
 * every reload, and the user learns their own sky instead of watching it
 * reshuffle.
 */

/** How the sky names things. Real catalogues, because they read as real. */
export const CATALOG_PREFIXES = ["NGC", "IC", "Messier", "Abell"] as const;

/** How many arms the home galaxy has. Live clusters sit along them. */
export const SPIRAL_ARMS = 4;

const SEED_PREFIX = 0x9e3779b9;
const SEED_NUMBER = 0x85ebca6b;
const SEED_ARM = 0xc2b2ae35;
const SEED_RADIUS = 0x27d4eb2f;
const SEED_ANGLE = 0x165667b1;
const SEED_TILT = 0x1b873593;
const SEED_ARMS = 0xcc9e2d51;

/**
 * The name the sky gives an ethered cluster. The user's own name for it stays
 * alongside -- this is what it is called out there, not what it is called here.
 */
export const catalogName = (clusterId: string): string => {
  const prefix = CATALOG_PREFIXES[hash32(clusterId, SEED_PREFIX) % CATALOG_PREFIXES.length];
  const number = 1000 + (hash32(clusterId, SEED_NUMBER) % 9000);
  return `${prefix} ${number}`;
};

export interface ArmSlot {
  /** Which spiral arm, 0-indexed. */
  arm: number;
  /** How far out along it, 0.3 (near the core) to 1 (the rim). */
  radius: number;
}

/**
 * Where a live cluster's knot sits on the disc. Held off the core so the
 * centre stays open and the knots never overlap the bulge.
 */
export const armSlot = (clusterId: string): ArmSlot => ({
  arm: hash32(clusterId, SEED_ARM) % SPIRAL_ARMS,
  radius: 0.3 + unit(hash32(clusterId, SEED_RADIUS)) * 0.7,
});

export interface DeepFieldPlacement {
  /** 0 (far edge of the field) to 1 (just beyond the home galaxy). */
  distance: number;
  /** Bearing around the field, in radians. */
  angle: number;
  /** How far the disc is tipped away from face-on, in radians. */
  tilt: number;
  /** How many arms this galaxy was drawn with. */
  arms: number;
}

/** The furthest a galaxy recedes, however long ago it was finished. */
const HORIZON = 0.22;

/**
 * Where an ethered cluster hangs in the deep field.
 *
 * `rank` is its place in the ethering order, newest first, so the longer ago a
 * project was finished the further out it sits and the more the field visibly
 * deepens as work gets done. The recession eases rather than running linearly,
 * so the twentieth galaxy still has somewhere to go.
 */
export const deepFieldPlacement = (clusterId: string, rank: number): DeepFieldPlacement => ({
  distance: HORIZON + (1 - HORIZON) / (1 + Math.max(0, rank) * 0.35),
  angle: unit(hash32(clusterId, SEED_ANGLE)) * Math.PI * 2,
  tilt: (unit(hash32(clusterId, SEED_TILT)) - 0.5) * ((Math.PI / 3) * 2),
  arms: 2 + (hash32(clusterId, SEED_ARMS) % 3),
});
