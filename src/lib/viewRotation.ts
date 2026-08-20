/**
 * Turning the whole system in space.
 *
 * The galaxy is drawn on a flat canvas, so "3D" here means rotating each body's
 * position through three axes and projecting the result straight down. Spin
 * turns the table, tilt lifts you above or below the plane, and yaw swings the
 * whole thing around the vertical. Nothing is stored: a rotation is a lens over
 * positions that are computed anyway.
 */

export interface ViewRotation {
  /** Around the view axis, degrees. Turning the table. */
  spin: number;
  /** Around the horizontal axis, degrees. Looking from above or below. */
  tilt: number;
  /** Around the vertical axis, degrees. Swinging left and right. */
  yaw: number;
}

export interface Point3 {
  x: number;
  y: number;
  z: number;
}

export const IDENTITY_ROTATION: ViewRotation = { spin: 0, tilt: 0, yaw: 0 };

const toRadians = (degrees: number): number =>
  ((Number.isFinite(degrees) ? degrees : 0) * Math.PI) / 180;

/**
 * Yaw, then tilt, then spin -- applied in that order so the spin always reads
 * as turning what you are already looking at, rather than tumbling the scene.
 */
export const rotatePoint = (point: Point3, rotation: ViewRotation): Point3 => {
  const yaw = toRadians(rotation.yaw);
  const tilt = toRadians(rotation.tilt);
  const spin = toRadians(rotation.spin);

  // Yaw: around Y, so horizontal spread swings away from the viewer.
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const x = point.x * cy + point.z * sy;
  let y = point.y;
  let z = -point.x * sy + point.z * cy;

  // Tilt: around X, so the plane goes edge-on as this approaches 90.
  const ct = Math.cos(tilt);
  const st = Math.sin(tilt);
  const y1 = y * ct - z * st;
  const z1 = y * st + z * ct;
  y = y1;
  z = z1;

  // Spin: around Z, the view axis.
  const cs = Math.cos(spin);
  const ss = Math.sin(spin);
  const x2 = x * cs - y * ss;
  const y2 = x * ss + y * cs;

  return { x: x2, y: y2, z };
};

const EPSILON = 1e-6;

export const isIdentityRotation = (rotation: ViewRotation): boolean =>
  Math.abs(rotation.spin) < EPSILON &&
  Math.abs(rotation.tilt) < EPSILON &&
  Math.abs(rotation.yaw) < EPSILON;

/**
 * The configurations Flow moves between. Each is a different way of looking at
 * the same work: overhead, along the plane, from underneath, cocked over.
 */
export const FLOW_PRESETS: readonly ViewRotation[] = [
  { spin: 0, tilt: 0, yaw: 0 }, // straight on
  { spin: 24, tilt: 58, yaw: 12 }, // raked, looking down the plane
  { spin: -18, tilt: 78, yaw: -30 }, // nearly edge-on
  { spin: 40, tilt: 34, yaw: 46 }, // cocked over one shoulder
  { spin: -35, tilt: -52, yaw: 20 }, // from underneath
] as const;

/** Smoothstep, so a leg eases out of one configuration and into the next. */
const ease = (t: number): number => t * t * (3 - 2 * t);

/**
 * Where Flow has drifted to at a moment in time. Legs of `legMs` each, looping
 * back to the first configuration at the end.
 */
export const flowRotationAt = (now: number, legMs: number): ViewRotation => {
  const elapsed = Number.isFinite(now) && now > 0 ? now : 0;
  const leg = Number.isFinite(legMs) && legMs > 0 ? legMs : 1;
  const total = FLOW_PRESETS.length;

  const position = elapsed / leg;
  const index = Math.floor(position) % total;
  const from = FLOW_PRESETS[index];
  const to = FLOW_PRESETS[(index + 1) % total];
  const t = ease(position - Math.floor(position));

  return {
    spin: from.spin + (to.spin - from.spin) * t,
    tilt: from.tilt + (to.tilt - from.tilt) * t,
    yaw: from.yaw + (to.yaw - from.yaw) * t,
  };
};

/**
 * The inverse of rotatePoint: takes a point as it appears on screen back to
 * where it lives in the system's own frame. Needed when a drag lands somewhere
 * and has to be understood as an angle on an orbit rather than a screen point.
 * Undoes spin, then tilt, then yaw -- the reverse of the order they went on.
 */
export const unrotatePoint = (point: Point3, rotation: ViewRotation): Point3 => {
  const yaw = toRadians(rotation.yaw);
  const tilt = toRadians(rotation.tilt);
  const spin = toRadians(rotation.spin);

  const cs = Math.cos(-spin);
  const ss = Math.sin(-spin);
  const x1 = point.x * cs - point.y * ss;
  const y1 = point.x * ss + point.y * cs;

  const ct = Math.cos(-tilt);
  const st = Math.sin(-tilt);
  const y2 = y1 * ct - point.z * st;
  const z2 = y1 * st + point.z * ct;

  const cy = Math.cos(-yaw);
  const sy = Math.sin(-yaw);
  const x3 = x1 * cy + z2 * sy;
  const z3 = -x1 * sy + z2 * cy;

  return { x: x3, y: y2, z: z3 };
};
