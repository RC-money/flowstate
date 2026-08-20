import type { Task, TaskStatus } from "../hooks/useLocalTasks";
import { isTerminal, type Column } from "./columns/columns";
import { hash32, unit } from "./hash";

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
 * Stamps or clears completedAt for a status transition. Reaching the board's
 * last column earns the timestamp once; leaving it surrenders it -- the sky
 * only shows work that is actually finished.
 *
 * The finish line is the last column, whatever the user named it, so a board
 * ending in "Shipped" or "Verified" earns its stars exactly the same way.
 */
export const stampCompletion = (
  task: Task,
  nextStatus: TaskStatus,
  now: number,
  columns: Column[]
): Task => {
  if (isTerminal(columns, nextStatus)) {
    return task.completedAt ? task : { ...task, completedAt: now };
  }
  if (task.completedAt === undefined) return task;
  const rest = { ...task };
  delete rest.completedAt;
  return rest;
};

export const deriveStars = (tasks: Task[]): EarnedStar[] => {
  const stars: EarnedStar[] = [];
  for (const task of tasks) {
    // completedAt alone, not the column: it is stamped on reaching the last
    // column and cleared on leaving it, and it is the only thing that still
    // means "finished" once a board renames or reorders its columns.
    if (task.completedAt === undefined) continue;

    const lifespanDays = Math.max(0, task.completedAt - task.createdAt) / DAY;
    let brightness =
      MIN_BRIGHTNESS +
      (1 - MIN_BRIGHTNESS) * Math.min(1, lifespanDays / FULL_BRIGHTNESS_DAYS);
    // Sent into the Ether: the card is gone, so the star carries everything.
    if (task.etheredAt !== undefined) brightness = Math.max(brightness, 0.9);

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
