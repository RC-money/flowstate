import { describe, expect, it } from "vitest";
import { tasksToGraph } from "./graphTransforms";
import type { Task } from "../../hooks/useLocalTasks";

const NOW = 1_700_000_000_000;

const task = (over: Partial<Task> & { id: string }): Task => ({
  title: over.id,
  status: "TO-DO",
  createdAt: NOW,
  updatedAt: NOW,
  ...over,
});

const blockedIds = (tasks: Task[]): string[] =>
  tasksToGraph(tasks)
    .nodes.filter((node) => node.blocked)
    .map((node) => node.id);

describe("blocked: waiting on work that is not finished", () => {
  it("blocks a task whose dependency is still open", () => {
    const tasks = [task({ id: "a" }), task({ id: "b", dependsOn: ["a"] })];

    expect(blockedIds(tasks)).toEqual(["b"]);
  });

  it("frees a task once its dependency is finished", () => {
    const tasks = [
      task({ id: "a", status: "DONE", completedAt: NOW }),
      task({ id: "b", dependsOn: ["a"] }),
    ];

    expect(blockedIds(tasks)).toEqual([]);
  });

  it("counts a dependency sent to the ether as finished", () => {
    const tasks = [
      task({ id: "a", status: "DONE", completedAt: NOW, etheredAt: NOW }),
      task({ id: "b", dependsOn: ["a"] }),
    ];

    expect(blockedIds(tasks)).toEqual([]);
  });

  it("stays blocked while any one dependency is open", () => {
    const tasks = [
      task({ id: "a", status: "DONE", completedAt: NOW }),
      task({ id: "b" }),
      task({ id: "c", dependsOn: ["a", "b"] }),
    ];

    expect(blockedIds(tasks)).toEqual(["c"]);
  });

  it("ignores a dependency on a task that no longer exists", () => {
    const tasks = [task({ id: "b", dependsOn: ["deleted"] })];

    expect(blockedIds(tasks)).toEqual([]);
  });

  it("leaves a task with no dependencies alone", () => {
    expect(blockedIds([task({ id: "a" })])).toEqual([]);
  });

  it("does not block a finished task that waited on something open", () => {
    // Its own work is done; what it once waited for is no longer its problem.
    const tasks = [
      task({ id: "a" }),
      task({ id: "b", status: "DONE", completedAt: NOW, dependsOn: ["a"] }),
    ];

    expect(blockedIds(tasks)).toEqual([]);
  });
});
