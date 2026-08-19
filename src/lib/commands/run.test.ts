import { describe, expect, test } from "vitest";
import { run } from "./run";
import type { Task } from "../../hooks/useLocalTasks";

const NOW = 1_755_500_000_000;
const DAY = 86_400_000;

const task = (id: string, title: string, extra: Partial<Task> = {}): Task => ({
  id,
  title,
  status: "TO-DO",
  createdAt: NOW - DAY,
  updatedAt: NOW - DAY,
  ...extra,
});

const board = [
  task("t1", "Refactor auth middleware"),
  task("t2", "Ship the pricing page", { status: "DONE", completedAt: NOW - DAY }),
  task("t3", "Write onboarding copy", { updatedAt: NOW - 20 * DAY }),
];

describe("run: move", () => {
  test("changes the matched task's status", () => {
    const result = run({ kind: "move", target: "auth", to: "IN PROGRESS" }, board, NOW);
    expect(result.tasks.find((t) => t.id === "t1")?.status).toBe("IN PROGRESS");
  });

  test("stamps completedAt when entering DONE", () => {
    const result = run({ kind: "move", target: "auth", to: "DONE" }, board, NOW);
    expect(result.tasks.find((t) => t.id === "t1")?.completedAt).toBe(NOW);
  });

  test("clears completedAt when leaving DONE", () => {
    const result = run({ kind: "move", target: "pricing", to: "TO-DO" }, board, NOW);
    expect(result.tasks.find((t) => t.id === "t2")?.completedAt).toBeUndefined();
  });

  test("touches updatedAt so decay resets", () => {
    const result = run({ kind: "move", target: "auth", to: "DONE" }, board, NOW);
    expect(result.tasks.find((t) => t.id === "t1")?.updatedAt).toBe(NOW);
  });

  test("leaves other tasks untouched", () => {
    const result = run({ kind: "move", target: "auth", to: "DONE" }, board, NOW);
    expect(result.tasks.find((t) => t.id === "t3")).toEqual(board[2]);
  });

  test("never mutates the board it was given", () => {
    const original = structuredClone(board);
    run({ kind: "move", target: "auth", to: "DONE" }, board, NOW);
    expect(board).toEqual(original);
  });
});

describe("run: undo", () => {
  test("a mutation carries the pre-change board", () => {
    const result = run({ kind: "move", target: "auth", to: "DONE" }, board, NOW);
    expect(result.undo).toEqual(board);
  });

  test("a read-only command carries no undo", () => {
    expect(run({ kind: "list", filter: "open" }, board, NOW).undo).toBeUndefined();
  });

  test("a refused command carries no undo", () => {
    expect(run({ kind: "move", target: "nothing here", to: "DONE" }, board, NOW).undo)
      .toBeUndefined();
  });
});

describe("run: refusals", () => {
  test("an ambiguous target changes nothing and names the candidates", () => {
    const twins = [task("a", "Fix login bug"), task("b", "Fix login copy")];
    const result = run({ kind: "move", target: "login", to: "DONE" }, twins, NOW);
    expect(result.tasks).toEqual(twins);
    expect(result.message).toContain("Fix login bug");
    expect(result.message).toContain("Fix login copy");
  });

  test("an unmatched target changes nothing", () => {
    const result = run({ kind: "move", target: "quarterly taxes", to: "DONE" }, board, NOW);
    expect(result.tasks).toEqual(board);
  });

  test("unknown text changes nothing and offers guidance", () => {
    const result = run({ kind: "unknown", text: "ponder work" }, board, NOW);
    expect(result.tasks).toEqual(board);
    expect(result.message).toMatch(/what's open|move/i);
  });
});

describe("run: list", () => {
  test("open excludes done and dark forest tasks", () => {
    const withDark = [...board, task("t4", "Old idea", { darkForest: true })];
    const result = run({ kind: "list", filter: "open" }, withDark, NOW);
    expect(result.listed?.map((t) => t.id)).toEqual(["t1", "t3"]);
  });

  test("decaying returns only neglected tasks, worst first", () => {
    const result = run({ kind: "list", filter: "decaying" }, board, NOW);
    expect(result.listed?.map((t) => t.id)).toEqual(["t3"]);
  });

  test("done returns finished work", () => {
    const result = run({ kind: "list", filter: "done" }, board, NOW);
    expect(result.listed?.map((t) => t.id)).toEqual(["t2"]);
  });
});

describe("run: dark forest", () => {
  test("darkForest sets the flag", () => {
    const result = run({ kind: "darkForest", target: "auth" }, board, NOW);
    expect(result.tasks.find((t) => t.id === "t1")?.darkForest).toBe(true);
  });

  test("restore clears it", () => {
    const resting = [task("t1", "Refactor auth middleware", { darkForest: true })];
    const result = run({ kind: "restore", target: "auth" }, resting, NOW);
    expect(result.tasks[0].darkForest).toBe(false);
  });
});

describe("run: create", () => {
  test("appends a TO-DO task with the given title", () => {
    const result = run({ kind: "create", title: "Book the venue" }, board, NOW, () => "t9");
    expect(result.tasks).toHaveLength(4);
    expect(result.tasks[3]).toMatchObject({
      id: "t9",
      title: "Book the venue",
      status: "TO-DO",
      createdAt: NOW,
      updatedAt: NOW,
    });
  });

  test("refuses an empty title", () => {
    const result = run({ kind: "create", title: "   " }, board, NOW);
    expect(result.tasks).toEqual(board);
    expect(result.undo).toBeUndefined();
  });
});
