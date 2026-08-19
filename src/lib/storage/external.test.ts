import { describe, expect, test } from "vitest";
import { shouldAdoptExternalChange } from "./external";
import type { Task } from "../../hooks/useLocalTasks";

const NOW = 1_755_500_000_000;
const task = (id: string, title: string): Task => ({
  id, title, status: "TO-DO", createdAt: NOW, updatedAt: NOW,
});

const board = [task("t1", "Refactor auth middleware")];
const boardRaw = JSON.stringify(board);
const otherRaw = JSON.stringify([task("t2", "Something Claude added")]);

describe("shouldAdoptExternalChange", () => {
  test("adopts a board written by someone else", () => {
    const result = shouldAdoptExternalChange(otherRaw, boardRaw);
    expect(result.adopt).toBe(true);
    expect(result.tasks?.[0].id).toBe("t2");
  });

  test("ignores the echo of our own save", () => {
    // The watcher fires on every write including ours; re-hydrating here
    // would fight the user's in-flight edits.
    expect(shouldAdoptExternalChange(boardRaw, boardRaw).adopt).toBe(false);
  });

  test("ignores an echo that differs only in formatting", () => {
    // The MCP server writes pretty-printed JSON; the app writes compact.
    const pretty = JSON.stringify(board, null, 2);
    expect(shouldAdoptExternalChange(pretty, boardRaw).adopt).toBe(false);
  });

  test("ignores a corrupt file rather than wiping the board", () => {
    expect(shouldAdoptExternalChange("{not json", boardRaw).adopt).toBe(false);
  });

  test("ignores an unreadable file", () => {
    expect(shouldAdoptExternalChange(null, boardRaw).adopt).toBe(false);
  });

  test("adopts an external deletion of every task", () => {
    const result = shouldAdoptExternalChange("[]", boardRaw);
    expect(result.adopt).toBe(true);
    expect(result.tasks).toEqual([]);
  });

  test("adopts when we have not written anything yet", () => {
    expect(shouldAdoptExternalChange(otherRaw, null).adopt).toBe(true);
  });
});
