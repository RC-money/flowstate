import { describe, expect, test } from "vitest";
import { shouldShowWelcome } from "./firstRun";
import type { Task } from "../../hooks/useLocalTasks";

const NOW = 1_755_500_000_000;
const board: Task[] = [
  { id: "t1", title: "Real work", status: "TO-DO", createdAt: NOW, updatedAt: NOW },
];

describe("shouldShowWelcome", () => {
  test("shows when nothing has ever been stored", () => {
    expect(shouldShowWelcome({ welcomed: false, storedBoard: null })).toBe(true);
  });

  test("stays hidden once dismissed", () => {
    expect(shouldShowWelcome({ welcomed: true, storedBoard: null })).toBe(false);
  });

  test("never appears over a stored board with work in it", () => {
    // The flag lives in localStorage, the board in a file the MCP server also
    // writes; in the desktop app the two can disagree. Welcome offers "start
    // with empty space", so showing it over real work destroys that work.
    expect(shouldShowWelcome({ welcomed: false, storedBoard: board })).toBe(false);
  });

  test("shows over a stored but empty board -- nothing to lose", () => {
    expect(shouldShowWelcome({ welcomed: false, storedBoard: [] })).toBe(true);
  });

  test("hidden when both say so", () => {
    expect(shouldShowWelcome({ welcomed: true, storedBoard: board })).toBe(false);
  });
});
