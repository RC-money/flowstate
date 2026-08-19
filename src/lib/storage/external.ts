import { coerceTasks, type Task } from "../../hooks/useLocalTasks";

export interface ExternalChange {
  adopt: boolean;
  tasks?: Task[];
}

const IGNORE: ExternalChange = { adopt: false };

/**
 * Decides whether a change to tasks.json came from outside the app.
 *
 * The watcher fires on every write to the file including our own, so the echo
 * of our last save has to be filtered out -- re-hydrating from it would stomp
 * whatever the user typed in the meantime. Comparison is on parsed content,
 * not raw text, because the MCP server pretty-prints and the app writes
 * compact: byte equality would treat every one of our own saves as foreign.
 *
 * Corrupt or unreadable files are ignored rather than adopted. A half-written
 * file is a normal thing to observe mid-write, and adopting it would empty a
 * real board.
 */
export const shouldAdoptExternalChange = (
  fileRaw: string | null,
  lastWrittenRaw: string | null
): ExternalChange => {
  if (fileRaw === null) return IGNORE;

  let incoming: Task[] | null;
  try {
    incoming = coerceTasks(JSON.parse(fileRaw));
  } catch {
    return IGNORE;
  }
  if (!incoming) return IGNORE;

  if (lastWrittenRaw !== null) {
    try {
      const ours = JSON.parse(lastWrittenRaw);
      if (JSON.stringify(ours) === JSON.stringify(incoming)) return IGNORE;
    } catch {
      // Our own record is unreadable; fall through and adopt the file.
    }
  }

  return { adopt: true, tasks: incoming };
};
