import { normalizeBoard, type Board } from "../clusters/board";

export interface Hydration {
  board: Board | null;
  source: "file" | "legacy" | "none";
}

const parseBoard = (raw: string | null, now: number): Board | null => {
  if (raw === null) return null;
  try {
    return normalizeBoard(JSON.parse(raw), now);
  } catch {
    return null;
  }
};

/**
 * Decides which board a launch starts from. Pure -- all IO stays in the
 * adapters.
 *
 * The file always wins over legacy localStorage, including when it holds no
 * tasks: an empty board means the user deleted their tasks, and resurrecting
 * the legacy board would silently undo that. Legacy is only adopted when the
 * file is missing or unreadable -- the one-time migration path, and the safety
 * net if the file ever corrupts.
 *
 * Either side may be in the pre-clusters shape; `normalizeBoard` wraps it.
 */
export const decideHydration = (
  fileRaw: string | null,
  legacyRaw: string | null,
  now: number
): Hydration => {
  const fromFile = parseBoard(fileRaw, now);
  if (fromFile) return { board: fromFile, source: "file" };

  const fromLegacy = parseBoard(legacyRaw, now);
  if (fromLegacy) return { board: fromLegacy, source: "legacy" };

  return { board: null, source: "none" };
};
