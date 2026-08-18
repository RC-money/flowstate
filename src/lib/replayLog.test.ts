import { describe, expect, test } from "vitest";
import { replayLog, logTimeRange } from "./replayLog";
import type { Task } from "../hooks/useLocalTasks";
import type { TaskLogEvent } from "./taskLog";

const T0 = 1_755_000_000_000;
const MIN = 60_000;

const task = (id: string, status: Task["status"], over: Partial<Task> = {}): Task => ({
  id, title: `Task ${id}`, status, createdAt: T0, updatedAt: T0, ...over,
});

describe("replayLog", () => {
  test("at 'now', replay returns current tasks untouched", () => {
    const current = [task("a", "DONE"), task("b", "TO-DO")];
    expect(replayLog([], current, Date.now())).toEqual(current);
  });

  test("undoes a move: before the event the task sits in its old column", () => {
    const current = [task("a", "DONE")];
    const log: TaskLogEvent[] = [
      { t: T0 + 10 * MIN, taskId: "a", kind: "completed", from: "IN PROGRESS", to: "DONE" },
    ];
    const before = replayLog(log, current, T0 + 5 * MIN);
    expect(before[0].status).toBe("IN PROGRESS");
  });

  test("a task created after T does not exist at T", () => {
    const current = [task("a", "TO-DO"), task("b", "TO-DO")];
    const log: TaskLogEvent[] = [
      { t: T0 + 10 * MIN, taskId: "b", kind: "created", to: "TO-DO" },
    ];
    const before = replayLog(log, current, T0 + 5 * MIN);
    expect(before.map((x) => x.id)).toEqual(["a"]);
  });

  test("a task deleted after T is resurrected at T", () => {
    const current = [task("a", "TO-DO")];
    const log: TaskLogEvent[] = [
      { t: T0 + 10 * MIN, taskId: "gone", kind: "deleted", title: "The Departed" },
    ];
    const before = replayLog(log, current, T0 + 5 * MIN);
    const ghost = before.find((x) => x.id === "gone");
    expect(ghost).toBeDefined();
    expect(ghost!.title).toBe("The Departed");
  });

  test("archive/restore reverse cleanly", () => {
    const current = [task("a", "TO-DO", { darkForest: true })];
    const log: TaskLogEvent[] = [
      { t: T0 + 10 * MIN, taskId: "a", kind: "archived" },
    ];
    expect(replayLog(log, current, T0 + 5 * MIN)[0].darkForest).toBe(false);
    const current2 = [task("a", "TO-DO", { darkForest: false })];
    const log2: TaskLogEvent[] = [
      { t: T0 + 10 * MIN, taskId: "a", kind: "restored" },
    ];
    expect(replayLog(log2, current2, T0 + 5 * MIN)[0].darkForest).toBe(true);
  });

  test("undoing a completion also removes the earned star's stamp", () => {
    const current = [task("a", "DONE", { completedAt: T0 + 10 * MIN })];
    const log: TaskLogEvent[] = [
      { t: T0 + 10 * MIN, taskId: "a", kind: "completed", from: "IN PROGRESS", to: "DONE" },
    ];
    const before = replayLog(log, current, T0 + 5 * MIN);
    expect(before[0].completedAt).toBeUndefined();
  });

  test("a chain of events unwinds in order", () => {
    const current = [task("a", "DONE")];
    const log: TaskLogEvent[] = [
      { t: T0 + 2 * MIN, taskId: "a", kind: "created", to: "TO-DO" },
      { t: T0 + 4 * MIN, taskId: "a", kind: "moved", from: "TO-DO", to: "IN PROGRESS" },
      { t: T0 + 6 * MIN, taskId: "a", kind: "completed", from: "IN PROGRESS", to: "DONE" },
    ];
    expect(replayLog(log, current, T0 + 5 * MIN)[0].status).toBe("IN PROGRESS");
    expect(replayLog(log, current, T0 + 3 * MIN)[0].status).toBe("TO-DO");
    expect(replayLog(log, current, T0 + 1 * MIN)).toHaveLength(0);
  });

  test("events at exactly T are already applied", () => {
    const current = [task("a", "DONE")];
    const log: TaskLogEvent[] = [
      { t: T0 + 5 * MIN, taskId: "a", kind: "completed", from: "TO-DO", to: "DONE" },
    ];
    expect(replayLog(log, current, T0 + 5 * MIN)[0].status).toBe("DONE");
  });
});

describe("ether replay", () => {
  test("rewinding before the ether moment restores the card", () => {
    const current = [task("a", "DONE", { completedAt: T0 + 2 * MIN, etheredAt: T0 + 10 * MIN })];
    const log: TaskLogEvent[] = [
      { t: T0 + 10 * MIN, taskId: "a", kind: "ethered" },
    ];
    const before = replayLog(log, current, T0 + 5 * MIN);
    expect(before[0].etheredAt).toBeUndefined();
    expect(before[0].completedAt).toBe(T0 + 2 * MIN);
  });
});

describe("logTimeRange", () => {
  test("returns null for an empty log", () => {
    expect(logTimeRange([])).toBeNull();
  });

  test("returns first and last event times", () => {
    const log: TaskLogEvent[] = [
      { t: 100, taskId: "a", kind: "created" },
      { t: 900, taskId: "a", kind: "deleted" },
    ];
    expect(logTimeRange(log)).toEqual({ start: 100, end: 900 });
  });
});
