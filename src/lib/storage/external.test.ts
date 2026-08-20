import { describe, expect, test } from "vitest";
import { shouldAdoptExternalChange } from "./external";
import type { Task } from "../../hooks/useLocalTasks";

const NOW = 1_755_500_000_000;
const task = (id: string, title: string): Task => ({
  id, title, status: "TO-DO", createdAt: NOW, updatedAt: NOW, clusterId: "c_1",
});
const clusters = [{ id: "c_1", name: "Flowstate", createdAt: NOW }];

const board = { clusters, tasks: [task("t1", "Refactor auth middleware")] };
const boardRaw = JSON.stringify(board);
const otherRaw = JSON.stringify({
  clusters,
  tasks: [task("t2", "Something Claude added")],
});

describe("shouldAdoptExternalChange", () => {
  test("adopts a board written by someone else", () => {
    const result = shouldAdoptExternalChange(otherRaw, boardRaw, NOW);
    expect(result.adopt).toBe(true);
    expect(result.board?.tasks[0].id).toBe("t2");
  });

  test("ignores the echo of our own save", () => {
    // The watcher fires on every write including ours; re-hydrating here
    // would fight the user's in-flight edits.
    expect(shouldAdoptExternalChange(boardRaw, boardRaw, NOW).adopt).toBe(false);
  });

  test("ignores an echo that differs only in formatting", () => {
    // The MCP server writes pretty-printed JSON; the app writes compact.
    const pretty = JSON.stringify(board, null, 2);
    expect(shouldAdoptExternalChange(pretty, boardRaw, NOW).adopt).toBe(false);
  });

  test("ignores an echo whose top-level keys were written in the other order", () => {
    const reordered = JSON.stringify({ tasks: board.tasks, clusters: board.clusters });
    expect(shouldAdoptExternalChange(reordered, boardRaw, NOW).adopt).toBe(false);
  });

  test("ignores a corrupt file rather than wiping the board", () => {
    expect(shouldAdoptExternalChange("{not json", boardRaw, NOW).adopt).toBe(false);
  });

  test("ignores an unreadable file", () => {
    expect(shouldAdoptExternalChange(null, boardRaw, NOW).adopt).toBe(false);
  });

  test("adopts an external deletion of every task", () => {
    const result = shouldAdoptExternalChange(
      JSON.stringify({ clusters, tasks: [] }),
      boardRaw,
      NOW
    );
    expect(result.adopt).toBe(true);
    expect(result.board?.tasks).toEqual([]);
  });

  test("adopts when we have not written anything yet", () => {
    expect(shouldAdoptExternalChange(otherRaw, null, NOW).adopt).toBe(true);
  });

  test("adopts an MCP server still writing the pre-clusters shape", () => {
    const legacyShape = JSON.stringify([task("t3", "Written as a bare array")]);
    const result = shouldAdoptExternalChange(legacyShape, boardRaw, NOW);
    expect(result.adopt).toBe(true);
    expect(result.board?.tasks[0].id).toBe("t3");
  });
});
