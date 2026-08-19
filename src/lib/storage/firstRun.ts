import type { Task } from "../../hooks/useLocalTasks";

/**
 * Whether to show the first-run welcome.
 *
 * Gated on the *stored* board, not the in-memory one: at mount the app holds
 * seed tasks, so an empty tasks array cannot tell a first run from a returning
 * user. The flag lives in localStorage while the board lives in a file the MCP
 * server also writes, so the two can disagree -- and when they do the board
 * wins, because Welcome offers "start with empty space" and showing that over
 * real work destroys it.
 */
export const shouldShowWelcome = (input: {
  welcomed: boolean;
  storedBoard: Task[] | null;
}): boolean => {
  if (input.welcomed) return false;
  return !(input.storedBoard && input.storedBoard.length > 0);
};
