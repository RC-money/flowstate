import { describe, expect, it } from "vitest";
import {
  CATALOG_PREFIXES,
  SPIRAL_ARMS,
  armSlot,
  catalogName,
  deepFieldPlacement,
} from "./catalog";

describe("catalogName", () => {
  it("gives the same designation for the same cluster every time", () => {
    expect(catalogName("c_abc")).toBe(catalogName("c_abc"));
  });

  it("uses a real catalog prefix and a four-figure number", () => {
    const [prefix, number] = catalogName("c_abc").split(" ");

    expect(CATALOG_PREFIXES).toContain(prefix);
    expect(Number(number)).toBeGreaterThanOrEqual(1000);
    expect(Number(number)).toBeLessThanOrEqual(9999);
  });

  it("tells different clusters apart", () => {
    const names = new Set(
      Array.from({ length: 40 }, (_, i) => catalogName(`cluster_${i}`))
    );

    expect(names.size).toBeGreaterThan(35);
  });
});

describe("armSlot", () => {
  it("puts the same cluster on the same arm at the same radius every time", () => {
    expect(armSlot("c_abc")).toEqual(armSlot("c_abc"));
  });

  it("lands on one of the galaxy's arms", () => {
    const { arm } = armSlot("c_abc");

    expect(Number.isInteger(arm)).toBe(true);
    expect(arm).toBeGreaterThanOrEqual(0);
    expect(arm).toBeLessThan(SPIRAL_ARMS);
  });

  it("sits out along the arm rather than on the core or off the edge", () => {
    for (let i = 0; i < 60; i += 1) {
      const { radius } = armSlot(`cluster_${i}`);

      expect(radius).toBeGreaterThanOrEqual(0.3);
      expect(radius).toBeLessThanOrEqual(1);
    }
  });

  it("spreads clusters across every arm rather than crowding one", () => {
    const arms = new Set(
      Array.from({ length: 60 }, (_, i) => armSlot(`cluster_${i}`).arm)
    );

    expect(arms.size).toBe(SPIRAL_ARMS);
  });
});

describe("deepFieldPlacement", () => {
  it("is the same for the same cluster at the same rank", () => {
    expect(deepFieldPlacement("c_abc", 2)).toEqual(deepFieldPlacement("c_abc", 2));
  });

  it("puts galaxies ethered longer ago further out", () => {
    const oldest = deepFieldPlacement("c_abc", 0);
    const newest = deepFieldPlacement("c_abc", 5);

    expect(oldest.distance).toBeGreaterThan(newest.distance);
  });

  it("keeps every galaxy inside the drawable field", () => {
    for (let rank = 0; rank < 20; rank += 1) {
      const { distance } = deepFieldPlacement(`cluster_${rank}`, rank);

      expect(distance).toBeGreaterThan(0);
      expect(distance).toBeLessThanOrEqual(1);
    }
  });

  it("gives each galaxy its own angle, tilt and arm count", () => {
    const { angle, tilt, arms } = deepFieldPlacement("c_abc", 0);

    expect(angle).toBeGreaterThanOrEqual(0);
    expect(angle).toBeLessThan(Math.PI * 2);
    expect(Math.abs(tilt)).toBeLessThanOrEqual(Math.PI / 3);
    expect([2, 3, 4]).toContain(arms);
  });
});
