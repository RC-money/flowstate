import { normalizeBoard, type Board } from "../clusters/board";

export interface ExternalChange {
  adopt: boolean;
  board?: Board;
}

const IGNORE: ExternalChange = { adopt: false };

const parse = (raw: string, now: number): Board | null => {
  try {
    return normalizeBoard(JSON.parse(raw), now);
  } catch {
    return null;
  }
};

/**
 * Decides whether a change to tasks.json came from outside the app.
 *
 * The watcher fires on every write to the file including our own, so the echo
 * of our last save has to be filtered out -- re-hydrating from it would stomp
 * whatever the user typed in the meantime. Both sides are normalized before
 * comparison, not compared as raw text: the MCP server pretty-prints where the
 * app writes compact, and may still be writing the pre-clusters array shape.
 * Byte equality would treat every one of our own saves as foreign.
 *
 * Corrupt or unreadable files are ignored rather than adopted. A half-written
 * file is a normal thing to observe mid-write, and adopting it would empty a
 * real board.
 */
export const shouldAdoptExternalChange = (
  fileRaw: string | null,
  lastWrittenRaw: string | null,
  now: number
): ExternalChange => {
  if (fileRaw === null) return IGNORE;

  const incoming = parse(fileRaw, now);
  if (!incoming) return IGNORE;

  if (lastWrittenRaw !== null) {
    const ours = parse(lastWrittenRaw, now);
    // An unreadable record of our own save falls through and adopts the file.
    if (ours && JSON.stringify(ours) === JSON.stringify(incoming)) return IGNORE;
  }

  return { adopt: true, board: incoming };
};
