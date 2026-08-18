import type { TaskStatus } from "../hooks/useLocalTasks";

/**
 * Append-only record of board mutations -- the memory the rewind scrubber
 * replays. Capped so it cannot grow unbounded; the cap holds weeks of normal
 * use, and rewind degrades gracefully past it (history simply starts later).
 */
export interface TaskLogEvent {
  /** Epoch ms. */
  t: number;
  taskId: string;
  kind: "created" | "moved" | "completed" | "deleted" | "restored" | "edited" | "archived";
  from?: TaskStatus;
  to?: TaskStatus;
  /** Title snapshot so replay can label bodies for since-deleted tasks. */
  title?: string;
}

export const LOG_CAP = 2000;
const KEY = "flowstate:v1:tasklog";

const isEvent = (raw: unknown): raw is TaskLogEvent =>
  Boolean(raw) &&
  typeof raw === "object" &&
  typeof (raw as TaskLogEvent).t === "number" &&
  typeof (raw as TaskLogEvent).taskId === "string" &&
  typeof (raw as TaskLogEvent).kind === "string";

export const readLog = (): TaskLogEvent[] => {
  if (typeof localStorage === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isEvent);
  } catch {
    return [];
  }
};

export const appendLogEvent = (event: TaskLogEvent): void => {
  if (typeof localStorage === "undefined") return;
  try {
    const log = readLog();
    log.push(event);
    localStorage.setItem(KEY, JSON.stringify(log.slice(-LOG_CAP)));
  } catch {
    // Quota or serialization failure: history is a luxury, never break the board.
  }
};
