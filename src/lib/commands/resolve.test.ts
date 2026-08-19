import { describe, expect, test } from "vitest";
import { resolve } from "./resolve";
import type { Task } from "../../hooks/useLocalTasks";

const NOW = 1_755_500_000_000;
const task = (id: string, title: string): Task => ({
  id,
  title,
  status: "TO-DO",
  createdAt: NOW,
  updatedAt: NOW,
});

const board = [
  task("t1", "Refactor auth middleware"),
  task("t2", "Ship the pricing page"),
  task("t3", "Write onboarding copy"),
];

describe("resolve", () => {
  test("matches an exact title", () => {
    expect(resolve("Ship the pricing page", board)).toEqual({
      kind: "hit",
      task: board[1],
    });
  });

  test("matches on a distinctive word", () => {
    expect(resolve("auth", board)).toEqual({ kind: "hit", task: board[0] });
  });

  test("ignores filler words around the real target", () => {
    expect(resolve("the auth thing", board)).toEqual({
      kind: "hit",
      task: board[0],
    });
  });

  test("tolerates a typo", () => {
    expect(resolve("onbaording", board)).toEqual({ kind: "hit", task: board[2] });
  });

  test("reports every candidate when the target is ambiguous", () => {
    const twins = [task("a", "Fix login bug"), task("b", "Fix login copy")];
    const result = resolve("login", twins);
    expect(result.kind).toBe("ambiguous");
    expect(result.kind === "ambiguous" && result.candidates).toHaveLength(2);
  });

  test("misses rather than guessing when nothing is close", () => {
    expect(resolve("quarterly taxes", board)).toEqual({ kind: "miss" });
  });

  test("misses on an empty board", () => {
    expect(resolve("anything", [])).toEqual({ kind: "miss" });
  });
});
