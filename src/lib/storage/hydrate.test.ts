import { describe, expect, test } from "vitest";
import { decideHydration } from "./hydrate";
import { DEFAULT_CLUSTER_ID } from "../clusters/board";
import type { Task } from "../../hooks/useLocalTasks";

const NOW = 1_755_500_000_000;
const task = (id: string, title: string): Task => ({
  id, title, status: "TO-DO", createdAt: NOW, updatedAt: NOW,
});
const fileBoard = JSON.stringify([task("f1", "From the file")]);
const legacyBoard = JSON.stringify([task("l1", "From localStorage")]);
const clusteredBoard = JSON.stringify({
  clusters: [{ id: "c_1", name: "Flowstate v2", createdAt: NOW }],
  tasks: [{ ...task("f1", "From the file"), clusterId: "c_1" }],
});

describe("decideHydration", () => {
  test("the file wins when it exists", () => {
    const result = decideHydration(fileBoard, legacyBoard, NOW);
    expect(result.source).toBe("file");
    expect(result.board?.tasks[0].id).toBe("f1");
  });

  test("legacy localStorage is adopted when there is no file yet", () => {
    const result = decideHydration(null, legacyBoard, NOW);
    expect(result.source).toBe("legacy");
    expect(result.board?.tasks[0].id).toBe("l1");
  });

  test("a fresh install has neither and starts empty", () => {
    expect(decideHydration(null, null, NOW)).toEqual({ source: "none", board: null });
  });

  test("a corrupt file falls back to legacy rather than wiping the board", () => {
    const result = decideHydration("{not json", legacyBoard, NOW);
    expect(result.source).toBe("legacy");
    expect(result.board?.tasks[0].id).toBe("l1");
  });

  test("an invalid-but-parseable file also falls back to legacy", () => {
    const result = decideHydration('[{"nope": true}]', legacyBoard, NOW);
    expect(result.source).toBe("legacy");
  });

  test("an empty file array is respected, not treated as missing", () => {
    // The user deleted every task; resurrecting the legacy board would undo that.
    const result = decideHydration("[]", legacyBoard, NOW);
    expect(result.source).toBe("file");
    expect(result.board?.tasks).toEqual([]);
  });

  test("a board saved before clusters existed arrives inside the home cluster", () => {
    const result = decideHydration(fileBoard, null, NOW);
    expect(result.board?.clusters[0].id).toBe(DEFAULT_CLUSTER_ID);
    expect(result.board?.tasks[0].clusterId).toBe(DEFAULT_CLUSTER_ID);
  });

  test("a board that already has clusters keeps them", () => {
    const result = decideHydration(clusteredBoard, null, NOW);
    expect(result.source).toBe("file");
    expect(result.board?.clusters[0].name).toBe("Flowstate v2");
    expect(result.board?.tasks[0].clusterId).toBe("c_1");
  });

  test("an empty clustered file is respected rather than falling back to legacy", () => {
    const result = decideHydration('{"clusters":[],"tasks":[]}', legacyBoard, NOW);
    expect(result.source).toBe("file");
    expect(result.board?.tasks).toEqual([]);
  });
});
