import { describe, expect, test } from "vitest";
import { analyzeConstellations } from "./analyzer";
import type { Task } from "../../hooks/useLocalTasks";
import type { Tether } from "../../types/celestial";

const NOW = 1_755_500_000_000;
const task = (id: string, title: string): Task => ({
  id, title, status: "TO-DO", createdAt: NOW, updatedAt: NOW,
});
const tether = (a: string, b: string): Tether => ({
  id: `${a}-${b}`, sourceId: a, targetId: b, createdAt: NOW, strength: 1,
});

describe("analyzeConstellations", () => {
  const tasks = [task("a", "Auth login"), task("b", "Auth tokens"), task("c", "Auth store"), task("d", "Solo")];
  const positions = { a: { x: 0, y: 0 }, b: { x: 50, y: 0 }, c: { x: 0, y: 50 }, d: { x: 900, y: 900 } };

  test("three tethered tasks form one constellation", () => {
    const found = analyzeConstellations(tasks, [tether("a", "b"), tether("b", "c")], positions);
    expect(found).toHaveLength(1);
    expect(found[0].memberIds.slice().sort()).toEqual(["a", "b", "c"]);
  });

  test("two tethered tasks are below the minimum and form nothing", () => {
    expect(analyzeConstellations(tasks, [tether("a", "b")], positions)).toHaveLength(0);
  });

  test("an untethered task joins nothing", () => {
    const found = analyzeConstellations(tasks, [tether("a", "b"), tether("b", "c")], positions);
    expect(found[0].memberIds).not.toContain("d");
  });

  test("members without positions produce no constellation rather than a broken one", () => {
    expect(analyzeConstellations(tasks, [tether("a", "b"), tether("b", "c")], {})).toHaveLength(0);
  });
});

describe("tag naming", () => {
  test("a cluster whose members all share a tag takes the tag as its name", () => {
    const tagged = [
      { id: "a", title: "Login flow", status: "TO-DO" as const, createdAt: NOW, updatedAt: NOW, tags: ["auth"] },
      { id: "b", title: "Token refresh", status: "TO-DO" as const, createdAt: NOW, updatedAt: NOW, tags: ["auth", "api"] },
      { id: "c", title: "Session store", status: "TO-DO" as const, createdAt: NOW, updatedAt: NOW, tags: ["Auth"] },
    ];
    const positions = { a: { x: 0, y: 0 }, b: { x: 40, y: 0 }, c: { x: 0, y: 40 } };
    const found = analyzeConstellations(tagged, [tether("a", "b"), tether("b", "c")], positions);
    expect(found[0].suggestedName).toBe("Auth");
  });
});
