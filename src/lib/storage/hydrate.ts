import { coerceTasks, type Task } from "../../hooks/useLocalTasks";

export interface Hydration {
  tasks: Task[] | null;
  source: "file" | "legacy" | "none";
}

const parseBoard = (raw: string | null): Task[] | null => {
  if (raw === null) return null;
  try {
    return coerceTasks(JSON.parse(raw));
  } catch {
    return null;
  }
};

/**
 * Decides which board a launch starts from. Pure -- all IO stays in the
 * adapters.
 *
 * The file always wins over legacy localStorage, including when it's an empty
 * array: "[]" means the user deleted their tasks, and resurrecting the legacy
 * board would silently undo that. Legacy is only adopted when the file is
 * missing or unreadable -- the one-time migration path, and the safety net if
 * the file ever corrupts.
 */
export const decideHydration = (
  fileRaw: string | null,
  legacyRaw: string | null
): Hydration => {
  const fromFile = parseBoard(fileRaw);
  if (fromFile) return { tasks: fromFile, source: "file" };

  const fromLegacy = parseBoard(legacyRaw);
  if (fromLegacy) return { tasks: fromLegacy, source: "legacy" };

  return { tasks: null, source: "none" };
};
