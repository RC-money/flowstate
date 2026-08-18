import { describe, expect, test } from "vitest";
import { subtaskProgress, toggleSubtask, addSubtask, removeSubtask, normalizeSubtasks } from "./subtasks";
import type { Subtask } from "./subtasks";

const NOW = 1_755_500_000_000;
const st = (id: string, done = false): Subtask => ({ id, title: `Sub ${id}`, done });

describe("subtaskProgress", () => {
  test("empty list reports zero of zero", () => {
    expect(subtaskProgress([])).toEqual({ done: 0, total: 0 });
    expect(subtaskProgress(undefined)).toEqual({ done: 0, total: 0 });
  });

  test("counts completed against total", () => {
    expect(subtaskProgress([st("a", true), st("b"), st("c", true)])).toEqual({ done: 2, total: 3 });
  });
});

describe("toggleSubtask", () => {
  test("completing stamps completedAt", () => {
    const next = toggleSubtask([st("a")], "a", NOW);
    expect(next[0].done).toBe(true);
    expect(next[0].completedAt).toBe(NOW);
  });

  test("un-completing clears the stamp", () => {
    const done: Subtask = { id: "a", title: "x", done: true, completedAt: NOW - 5 };
    const next = toggleSubtask([done], "a", NOW);
    expect(next[0].done).toBe(false);
    expect(next[0].completedAt).toBeUndefined();
  });

  test("leaves other subtasks untouched", () => {
    const next = toggleSubtask([st("a"), st("b")], "a", NOW);
    expect(next[1].done).toBe(false);
  });
});

describe("addSubtask / removeSubtask", () => {
  test("add appends with a fresh id and trimmed title", () => {
    const next = addSubtask([], "  Ship it  ");
    expect(next).toHaveLength(1);
    expect(next[0].title).toBe("Ship it");
    expect(next[0].done).toBe(false);
  });

  test("add ignores empty titles", () => {
    expect(addSubtask([], "   ")).toHaveLength(0);
  });

  test("remove drops by id", () => {
    expect(removeSubtask([st("a"), st("b")], "a").map((s) => s.id)).toEqual(["b"]);
  });
});

describe("normalizeSubtasks", () => {
  test("filters garbage rows and never throws", () => {
    const raw = [st("a", true), { junk: 1 }, null, { id: "b", title: "ok", done: "yes" }];
    const next = normalizeSubtasks(raw)!;
    expect(next.map((s) => s.id)).toEqual(["a", "b"]);
    expect(next[1].done).toBe(true);
  });

  test("non-arrays become undefined", () => {
    expect(normalizeSubtasks("nope")).toBeUndefined();
    expect(normalizeSubtasks(undefined)).toBeUndefined();
  });
});
