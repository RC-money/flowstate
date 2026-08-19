import { describe, expect, test } from "vitest";
import { decideHydration } from "./hydrate";
import type { Task } from "../../hooks/useLocalTasks";

const NOW = 1_755_500_000_000;
const task = (id: string, title: string): Task => ({
  id, title, status: "TO-DO", createdAt: NOW, updatedAt: NOW,
});
const fileBoard = JSON.stringify([task("f1", "From the file")]);
const legacyBoard = JSON.stringify([task("l1", "From localStorage")]);

describe("decideHydration", () => {
  test("the file wins when it exists", () => {
    const result = decideHydration(fileBoard, legacyBoard);
    expect(result.source).toBe("file");
    expect(result.tasks?.[0].id).toBe("f1");
  });

  test("legacy localStorage is adopted when there is no file yet", () => {
    const result = decideHydration(null, legacyBoard);
    expect(result.source).toBe("legacy");
    expect(result.tasks?.[0].id).toBe("l1");
  });

  test("a fresh install has neither and starts empty", () => {
    expect(decideHydration(null, null)).toEqual({ source: "none", tasks: null });
  });

  test("a corrupt file falls back to legacy rather than wiping the board", () => {
    const result = decideHydration("{not json", legacyBoard);
    expect(result.source).toBe("legacy");
    expect(result.tasks?.[0].id).toBe("l1");
  });

  test("an invalid-but-parseable file also falls back to legacy", () => {
    const result = decideHydration('[{"nope": true}]', legacyBoard);
    expect(result.source).toBe("legacy");
  });

  test("an empty file array is respected, not treated as missing", () => {
    // The user deleted every task; resurrecting the legacy board would undo that.
    const result = decideHydration("[]", legacyBoard);
    expect(result.source).toBe("file");
    expect(result.tasks).toEqual([]);
  });
});
