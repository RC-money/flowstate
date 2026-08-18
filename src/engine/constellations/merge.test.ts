import { describe, expect, test } from "vitest";
import { mergeConstellations } from "./merge";
import type { Constellation } from "../../types/celestial";

const c = (id: string, members: string[], name?: string): Constellation => ({
  id,
  memberIds: members,
  centroid: { x: 0, y: 0 },
  density: 1,
  suggestedName: `sug-${id}`,
  ...(name ? { name } : {}),
  createdAt: 1000,
  kind: "constellation",
});

describe("mergeConstellations", () => {
  test("keeps a user-given name when membership is identical", () => {
    const prev = [c("a-b-c", ["a", "b", "c"], "Auth Work")];
    const next = [c("a-b-c", ["a", "b", "c"])];
    expect(mergeConstellations(prev, next)[0].name).toBe("Auth Work");
  });

  test("keeps the name when membership overlaps by half or more", () => {
    const prev = [c("a-b-c-d", ["a", "b", "c", "d"], "Ops")];
    const next = [c("a-b-e", ["a", "b", "e"])];
    expect(mergeConstellations(prev, next)[0].name).toBe("Ops");
  });

  test("drops the name when overlap falls below half", () => {
    const prev = [c("a-b-c-d", ["a", "b", "c", "d"], "Ops")];
    const next = [c("a-x-y-z", ["a", "x", "y", "z"])];
    expect(mergeConstellations(prev, next)[0].name).toBeUndefined();
  });

  test("keeps the earliest createdAt so age is stable across re-analysis", () => {
    const prev = [{ ...c("a-b-c", ["a", "b", "c"], "Auth"), createdAt: 500 }];
    const next = [{ ...c("a-b-c", ["a", "b", "c"]), createdAt: 9000 }];
    expect(mergeConstellations(prev, next)[0].createdAt).toBe(500);
  });

  test("a name is inherited by at most one successor", () => {
    // If a cluster splits, the larger overlap wins the name.
    const prev = [c("a-b-c-d", ["a", "b", "c", "d"], "Ops")];
    const next = [c("a-b-c", ["a", "b", "c"]), c("d-e-f", ["d", "e", "f"])];
    const merged = mergeConstellations(prev, next);
    expect(merged.filter((m) => m.name === "Ops")).toHaveLength(1);
    expect(merged.find((m) => m.id === "a-b-c")?.name).toBe("Ops");
  });

  test("brand-new clusters pass through untouched", () => {
    const next = [c("x-y-z", ["x", "y", "z"])];
    expect(mergeConstellations([], next)).toEqual(next);
  });
});
