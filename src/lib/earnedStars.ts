import type { Task, TaskStatus } from "../hooks/useLocalTasks";

/**
 * A star earned by finishing a task. Positions are unit-square coordinates
 * derived from the task id, so the sky is stable across reloads without
 * storing a single coordinate.
 */
export interface EarnedStar {
  id: string;
  /** Horizontal position in [0, 1). */
  u: number;
  /** Vertical position in [0, 1). */
  v: number;
  /** 0.35..1 -- longer-lived tasks leave brighter stars. */
  brightness: number;
  completedAt: number;
}

const DAY = 86_400_000;

/** Lifespan (in days) at which a star reaches full brightness. */
const FULL_BRIGHTNESS_DAYS = 30;
const MIN_BRIGHTNESS = 0.35;

/**
 * Stamps or clears completedAt for a status transition. Entering DONE earns
 * the timestamp once; leaving DONE surrenders it -- the sky only shows work
 * that is actually finished.
 */
export const stampCompletion = (task: Task, nextStatus: TaskStatus, now: number): Task => {
  if (nextStatus === "DONE") {
    return task.completedAt ? task : { ...task, completedAt: now };
  }
  if (task.completedAt === undefined) return task;
  const rest = { ...task };
  delete rest.completedAt;
  return rest;
};

/**
 * FNV-1a, then two rounds of xorshift mixing. FNV alone leaves sequential ids
 * ("t1", "t2") clustered; the mixing scatters them.
 */
const hash32 = (text: string, seed: number): number => {
  let h = 0x811c9dc5 ^ seed;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 15;
  return h >>> 0;
};

const unit = (hash: number): number => hash / 0x1_0000_0000;

export const deriveStars = (tasks: Task[]): EarnedStar[] => {
  const stars: EarnedStar[] = [];
  for (const task of tasks) {
    // completedAt, not status: legacy DONE tasks without a stamp earn their
    // star the next time they are touched rather than appearing retroactively.
    if (task.status !== "DONE" || task.completedAt === undefined) continue;

    const lifespanDays = Math.max(0, task.completedAt - task.createdAt) / DAY;
    const brightness =
      MIN_BRIGHTNESS +
      (1 - MIN_BRIGHTNESS) * Math.min(1, lifespanDays / FULL_BRIGHTNESS_DAYS);

    stars.push({
      id: task.id,
      u: unit(hash32(task.id, 0x9e3779b9)),
      v: unit(hash32(task.id, 0x85ebca6b)),
      brightness,
      completedAt: task.completedAt,
    });
  }
  return stars;
};
