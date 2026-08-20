import { describe, expect, test } from "vitest";
import { resolve, resolveCluster } from "./resolve";
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

describe("resolveCluster", () => {
  const clusters = [
    { id: "c_1", name: "Flowstate v2", createdAt: 1 },
    { id: "c_2", name: "Gardening", createdAt: 2 },
    { id: "c_3", name: "Gone", createdAt: 3, etheredAt: 4 },
  ];

  test("matches a cluster by name", () => {
    const found = resolveCluster("gardening", clusters);
    expect(found.kind).toBe("hit");
    expect(found.kind === "hit" && found.cluster.id).toBe("c_2");
  });

  test("forgives a typo the way task names are forgiven", () => {
    const found = resolveCluster("gardenning", clusters);
    expect(found.kind === "hit" && found.cluster.id).toBe("c_2");
  });

  test("matches on part of a longer name", () => {
    const found = resolveCluster("flowstate", clusters);
    expect(found.kind === "hit" && found.cluster.id).toBe("c_1");
  });

  test("never reaches a cluster that has been ethered", () => {
    expect(resolveCluster("gone", clusters).kind).toBe("miss");
  });

  test("refuses rather than guessing between two equal matches", () => {
    const twins = [
      { id: "c_1", name: "Launch", createdAt: 1 },
      { id: "c_2", name: "Launch", createdAt: 2 },
    ];
    const found = resolveCluster("launch", twins);
    expect(found.kind).toBe("ambiguous");
    expect(found.kind === "ambiguous" && found.candidates).toHaveLength(2);
  });

  test("misses when nothing is close", () => {
    expect(resolveCluster("astrophysics", clusters).kind).toBe("miss");
  });
});
