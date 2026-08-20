/**
 * How subtask moons move around their planet.
 *
 * A task with one loose end feels twitchy, so its single moon whips around.
 * As subtasks accumulate the system gets heavier and settles: the orbit slows,
 * the planet swells, and past a threshold it earns rings. Nothing here is
 * stored -- the whole arrangement is a function of the subtask count and the
 * clock, so it survives reloads without a single persisted coordinate.
 */

/** Period for a single moon. Fast enough to read as restless. */
const BASE_PERIOD_MS = 4200;
/** Each additional subtask adds this much to the orbit. */
const PERIOD_PER_SUBTASK_MS = 2800;
/** Beyond this the orbit would read as frozen. */
const MAX_PERIOD_MS = 26_000;

/** Subtasks at which a planet earns rings. */
export const RING_THRESHOLD = 5;

/** Growth per subtask, and the ceiling on that growth. */
const SCALE_PER_SUBTASK = 0.055;
const MAX_SCALE = 1.6;
const MAX_COUNTED_SUBTASKS = 10;

/** Counts arrive from user data, so treat junk as the quietest case. */
const normalizeCount = (count: number): number => {
  if (!Number.isFinite(count) || count <= 0) return 1;
  return Math.floor(count);
};

/**
 * Milliseconds for one full revolution. Rises with subtask count, then flattens
 * so a task with fifty subtasks still turns rather than appearing stuck.
 */
export const orbitPeriodMs = (count: number): number => {
  const n = normalizeCount(count);
  return Math.min(MAX_PERIOD_MS, BASE_PERIOD_MS + (n - 1) * PERIOD_PER_SUBTASK_MS);
};

/**
 * Angle in radians for one moon at a moment in time. Moons stay evenly spaced
 * -- the whole ring rotates together rather than drifting apart.
 */
export const moonOrbitAngle = (index: number, count: number, now: number): number => {
  const n = normalizeCount(count);
  const spacing = (index / n) * Math.PI * 2;
  const elapsed = Number.isFinite(now) ? now : 0;
  const rotation = (elapsed / orbitPeriodMs(n)) * Math.PI * 2;
  // Start at the top; a moon sitting due north reads as deliberate placement.
  return spacing + rotation - Math.PI / 2;
};

/**
 * Multiplier on the planet's drawn radius. More subtasks means more mass.
 */
export const planetScale = (count: number): number => {
  if (!Number.isFinite(count) || count <= 0) return 1;
  const counted = Math.min(MAX_COUNTED_SUBTASKS, Math.floor(count));
  return Math.min(MAX_SCALE, 1 + counted * SCALE_PER_SUBTASK);
};

/** Whether a planet is heavy enough to have collected a ring system. */
export const hasRings = (count: number): boolean =>
  Number.isFinite(count) && count >= RING_THRESHOLD;
