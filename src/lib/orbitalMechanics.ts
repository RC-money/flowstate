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

/** How much a full-weight subtask stretches its moon's orbit. */
const HEAVINESS_DRAG = 1.6;

/** Range of per-moon orbital inclination, as a squash factor on the vertical. */
const MIN_INCLINATION = 0.16;
const MAX_INCLINATION = 0.78;

/** HELIOS: new work hugs the sun, finished work is flung to the outer dark. */
const HELIOS_RADII: Record<string, number> = {
  "TO-DO": 150,
  "IN PROGRESS": 280,
  DONE: 430,
};
const HELIOS_BASE_PERIOD_MS = 48_000;
const HELIOS_PERIOD_PER_SUBTASK_MS = 9_000;
const HELIOS_MAX_PERIOD_MS = 150_000;

/** Subtasks at which a planet earns rings. */
export const RING_THRESHOLD = 5;

/** Growth per subtask, and the ceiling on that growth. */
const SCALE_PER_SUBTASK = 0.11;
const MAX_SCALE = 2.3;
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
export const moonOrbitAngle = (
  index: number,
  count: number,
  now: number,
  heaviness = 0
): number => {
  const n = normalizeCount(count);
  const spacing = (index / n) * Math.PI * 2;
  const elapsed = Number.isFinite(now) ? now : 0;
  const mass = Number.isFinite(heaviness) ? Math.min(1, Math.max(0, heaviness)) : 0;
  // A subtask carrying more detail is heavier, and heavy things swing wide.
  const period = orbitPeriodMs(n) * (1 + mass * HEAVINESS_DRAG);
  const rotation = (elapsed / period) * Math.PI * 2;
  // Start at the top; a moon sitting due north reads as deliberate placement.
  return spacing + rotation - Math.PI / 2;
};

/**
 * How much text a subtask carries, as 0..1. Used as mass: the more a subtask
 * says, the more it weighs and the slower its moon comes round.
 */
export const subtaskHeaviness = (text?: string): number => {
  if (!text) return 0;
  // Saturating curve: the first sentence matters most, and nothing runs away.
  return 1 - Math.exp(-text.length / 60);
};

/**
 * Each moon rides its own inclination, so they are not all pinned to one flat
 * band. Some orbits read nearly edge-on, others wide open, which is what gives
 * the swarm vertical movement instead of a single ring.
 */
export const moonInclination = (index: number): number => {
  const i = Number.isFinite(index) ? Math.abs(Math.floor(index)) : 0;
  // Golden-angle stepping so consecutive moons never share a plane.
  const wobble = (i * 0.618033988749895) % 1;
  return MIN_INCLINATION + wobble * (MAX_INCLINATION - MIN_INCLINATION);
};

/** Distance from the sun for each column, in HELIOS. */
export const heliosRadius = (status: string): number =>
  HELIOS_RADII[status] ?? HELIOS_RADII["TO-DO"];

/**
 * How long a planet takes to lap the sun. Mass slows it: a task dragging six
 * subtasks behind it moves like it feels.
 */
export const heliosOrbitPeriodMs = (subtaskCount: number): number => {
  const n = Number.isFinite(subtaskCount) ? Math.max(0, Math.floor(subtaskCount)) : 0;
  return Math.min(
    HELIOS_MAX_PERIOD_MS,
    HELIOS_BASE_PERIOD_MS + n * HELIOS_PERIOD_PER_SUBTASK_MS
  );
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

/**
 * A stable starting angle for a task, hashed from its id. Nothing is stored --
 * the same task always sets out from the same point on its ring, the way
 * earned-star positions derive from the id rather than a saved coordinate.
 */
export const heliosPhase = (id: string): number => {
  let hash = 2166136261;
  for (let i = 0; i < id.length; i += 1) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 3600) / 3600 * Math.PI * 2;
};

/**
 * Where a planet sits around the sun at a moment in time. New work hugs the
 * sun, finished work rides the outer dark, and mass slows the lap.
 */
export const heliosPosition = (
  id: string,
  status: string,
  now: number,
  subtaskCount: number
): { x: number; y: number } => {
  const radius = heliosRadius(status);
  const elapsed = Number.isFinite(now) ? now : 0;
  const rotation = (elapsed / heliosOrbitPeriodMs(subtaskCount)) * Math.PI * 2;
  const angle = heliosPhase(id) + rotation;
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
};
