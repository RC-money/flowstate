import type { Task } from "../hooks/useLocalTasks";
import type { TaskLogEvent } from "./taskLog";

/**
 * Reconstructs the board as it stood at time T by walking the event log
 * BACKWARDS from the present, undoing each event that happened after T.
 * Starting from current state (rather than forward from an empty board) means
 * tasks that predate the log still appear -- history simply cannot reach
 * further back than recording started.
 */
export const replayLog = (log: TaskLogEvent[], currentTasks: Task[], at: number): Task[] => {
  const tasks = new Map(currentTasks.map((task) => [task.id, { ...task }]));

  // Newest first; undo everything strictly after T.
  const toUndo = log.filter((event) => event.t > at).sort((a, b) => b.t - a.t);

  for (const event of toUndo) {
    const existing = tasks.get(event.taskId);
    switch (event.kind) {
      case "created":
        tasks.delete(event.taskId);
        break;
      case "deleted": {
        // Resurrect: it existed at T. Status from the event when known.
        if (!existing) {
          tasks.set(event.taskId, {
            id: event.taskId,
            title: event.title ?? "(deleted task)",
            status: event.from ?? "TO-DO",
            createdAt: at,
            updatedAt: at,
          });
        }
        break;
      }
      case "moved":
      case "completed": {
        if (existing && event.from) {
          existing.status = event.from;
          if (event.to === "DONE") delete existing.completedAt;
        }
        break;
      }
      case "archived":
        if (existing) existing.darkForest = false;
        break;
      case "ethered":
        // Before it was sent into the Ether it was still a card on the board.
        if (existing) delete existing.etheredAt;
        break;
      case "restored":
        if (existing) existing.darkForest = true;
        break;
      case "edited":
        // Previous field values are not recorded; the edit stands.
        break;
    }
  }

  return Array.from(tasks.values());
};

export const logTimeRange = (log: TaskLogEvent[]): { start: number; end: number } | null => {
  if (!log.length) return null;
  let start = Infinity;
  let end = -Infinity;
  for (const event of log) {
    if (event.t < start) start = event.t;
    if (event.t > end) end = event.t;
  }
  return { start, end };
};
