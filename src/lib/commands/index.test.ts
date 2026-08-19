import { describe, expect, test } from "vitest";
import { execute } from "./index";
import type { Task } from "../../hooks/useLocalTasks";

const NOW = 1_755_500_000_000;
const DAY = 86_400_000;
const board: Task[] = [
  { id: "t1", title: "Refactor auth middleware", status: "TO-DO", createdAt: NOW - DAY, updatedAt: NOW - DAY },
  { id: "t2", title: "Ship the pricing page", status: "TO-DO", createdAt: NOW - DAY, updatedAt: NOW - DAY },
];

describe("execute", () => {
  test("carries plain English through to a board change", () => {
    const result = execute("move the auth thing to done", board, NOW);
    expect(result.tasks.find((t) => t.id === "t1")?.status).toBe("DONE");
    expect(result.undo).toEqual(board);
  });

  test("answers a question without changing anything", () => {
    const result = execute("what's open", board, NOW);
    expect(result.listed).toHaveLength(2);
    expect(result.tasks).toEqual(board);
    expect(result.undo).toBeUndefined();
  });

  test("unparseable input is refused, not guessed at", () => {
    const result = execute("reorganize my whole life", board, NOW);
    expect(result.tasks).toEqual(board);
    expect(result.undo).toBeUndefined();
  });
});
