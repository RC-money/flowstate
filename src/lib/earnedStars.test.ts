import { describe, expect, test } from "vitest";
import { stampCompletion, deriveStars } from "./earnedStars";
import { DEFAULT_COLUMNS } from "./columns/columns";
import type { Task } from "../hooks/useLocalTasks";

const NOW = 1_755_500_000_000;
const DAY = 86_400_000;

const task = (over: Partial<Task>): Task => ({
  id: "t1",
  title: "A task",
  status: "TO-DO",
  createdAt: NOW - 3 * DAY,
  updatedAt: NOW - DAY,
  ...over,
});

describe("stampCompletion", () => {
  test("stamps completedAt when a task enters DONE", () => {
    const next = stampCompletion(task({}), "DONE", NOW, DEFAULT_COLUMNS);
    expect(next.completedAt).toBe(NOW);
  });

  test("keeps the original completedAt when already DONE", () => {
    const done = task({ status: "DONE", completedAt: NOW - DAY });
    expect(stampCompletion(done, "DONE", NOW, DEFAULT_COLUMNS).completedAt).toBe(NOW - DAY);
  });

  test("clears completedAt when a task leaves DONE", () => {
    const done = task({ status: "DONE", completedAt: NOW - DAY });
    expect(stampCompletion(done, "IN PROGRESS", NOW, DEFAULT_COLUMNS).completedAt).toBeUndefined();
  });

  test("leaves non-DONE transitions unstamped", () => {
    expect(stampCompletion(task({}), "IN PROGRESS", NOW, DEFAULT_COLUMNS).completedAt).toBeUndefined();
  });
});

describe("deriveStars", () => {
  test("one star per completed task, none for unfinished work", () => {
    const tasks = [
      task({ id: "a", status: "DONE", completedAt: NOW - DAY }),
      task({ id: "b", status: "IN PROGRESS" }),
      task({ id: "c", status: "DONE", completedAt: NOW }),
    ];
    expect(deriveStars(tasks).map((s) => s.id)).toEqual(["a", "c"]);
  });

  test("ignores a DONE task that was never stamped", () => {
    // Legacy boards can hold DONE tasks that predate completedAt; they earn a
    // star the next time they are touched, not retroactively at random.
    expect(deriveStars([task({ id: "a", status: "DONE" })])).toEqual([]);
  });

  test("position is deterministic for the same id", () => {
    const tasks = [task({ id: "stable", status: "DONE", completedAt: NOW })];
    const first = deriveStars(tasks)[0];
    const second = deriveStars(tasks)[0];
    expect(first.u).toBe(second.u);
    expect(first.v).toBe(second.v);
  });

  test("position stays inside the unit square", () => {
    const many = Array.from({ length: 200 }, (_, i) =>
      task({ id: `t${i}`, status: "DONE", completedAt: NOW })
    );
    for (const star of deriveStars(many)) {
      expect(star.u).toBeGreaterThanOrEqual(0);
      expect(star.u).toBeLessThan(1);
      expect(star.v).toBeGreaterThanOrEqual(0);
      expect(star.v).toBeLessThan(1);
    }
  });

  test("different ids scatter to different positions", () => {
    const many = Array.from({ length: 50 }, (_, i) =>
      task({ id: `task-${i}`, status: "DONE", completedAt: NOW })
    );
    const seen = new Set(deriveStars(many).map((s) => `${s.u.toFixed(4)},${s.v.toFixed(4)}`));
    expect(seen.size).toBe(50);
  });

  test("a longer-lived task earns a brighter star", () => {
    const grind = task({ id: "g", status: "DONE", createdAt: NOW - 30 * DAY, completedAt: NOW });
    const quick = task({ id: "q", status: "DONE", createdAt: NOW - DAY / 24, completedAt: NOW });
    const stars = deriveStars([grind, quick]);
    const g = stars.find((s) => s.id === "g")!;
    const q = stars.find((s) => s.id === "q")!;
    expect(g.brightness).toBeGreaterThan(q.brightness);
  });

  test("brightness is clamped to a sane range", () => {
    const ancient = task({ id: "a", status: "DONE", createdAt: NOW - 400 * DAY, completedAt: NOW });
    const instant = task({ id: "i", status: "DONE", createdAt: NOW, completedAt: NOW });
    for (const star of deriveStars([ancient, instant])) {
      expect(star.brightness).toBeGreaterThanOrEqual(0.35);
      expect(star.brightness).toBeLessThanOrEqual(1);
    }
  });
});
