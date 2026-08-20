import { describe, expect, it } from "vitest";
import {
  hasRings,
  heliosOrbitPeriodMs,
  heliosRadius,
  moonOrbitAngle,
  orbitPeriodMs,
  planetScale,
  RING_THRESHOLD,
  subtaskHeaviness,
} from "./orbitalMechanics";

describe("orbitPeriodMs", () => {
  it("spins a lone moon fastest", () => {
    expect(orbitPeriodMs(1)).toBeLessThan(orbitPeriodMs(2));
  });

  it("slows down monotonically as subtasks pile up", () => {
    const periods = [1, 2, 3, 4, 5, 6, 8].map(orbitPeriodMs);
    for (let i = 1; i < periods.length; i += 1) {
      expect(periods[i]).toBeGreaterThan(periods[i - 1]);
    }
  });

  it("caps the period so a huge task still visibly turns", () => {
    expect(orbitPeriodMs(200)).toBe(orbitPeriodMs(1000));
  });

  it("treats an empty or nonsense count as a single moon", () => {
    expect(orbitPeriodMs(0)).toBe(orbitPeriodMs(1));
    expect(orbitPeriodMs(-4)).toBe(orbitPeriodMs(1));
    expect(orbitPeriodMs(Number.NaN)).toBe(orbitPeriodMs(1));
  });
});

describe("moonOrbitAngle", () => {
  it("spreads moons evenly around the planet", () => {
    const a = moonOrbitAngle(0, 4, 0);
    const b = moonOrbitAngle(1, 4, 0);
    expect(b - a).toBeCloseTo(Math.PI / 2, 6);
  });

  it("returns to the same angle after exactly one period", () => {
    const period = orbitPeriodMs(3);
    const start = moonOrbitAngle(0, 3, 0);
    const full = moonOrbitAngle(0, 3, period);
    expect(Math.cos(full)).toBeCloseTo(Math.cos(start), 6);
    expect(Math.sin(full)).toBeCloseTo(Math.sin(start), 6);
  });

  it("advances by a quarter turn at a quarter period", () => {
    const period = orbitPeriodMs(2);
    const start = moonOrbitAngle(0, 2, 0);
    const quarter = moonOrbitAngle(0, 2, period / 4);
    expect(quarter - start).toBeCloseTo(Math.PI / 2, 6);
  });

  it("keeps the gap between neighbours constant as time passes", () => {
    const now = 8123;
    const gap = moonOrbitAngle(2, 5, now) - moonOrbitAngle(1, 5, now);
    expect(gap).toBeCloseTo((Math.PI * 2) / 5, 6);
  });

  it("never returns a non-finite angle", () => {
    expect(Number.isFinite(moonOrbitAngle(0, 0, 1000))).toBe(true);
    expect(Number.isFinite(moonOrbitAngle(0, Number.NaN, 1000))).toBe(true);
  });
});

describe("planetScale", () => {
  it("leaves a task with no subtasks at its natural size", () => {
    expect(planetScale(0)).toBe(1);
  });

  it("grows with subtask count", () => {
    expect(planetScale(4)).toBeGreaterThan(planetScale(1));
  });

  it("stops growing past the cap so one task cannot swallow the galaxy", () => {
    expect(planetScale(50)).toBe(planetScale(500));
    expect(planetScale(500)).toBeLessThanOrEqual(1.6);
  });
});

describe("hasRings", () => {
  it("withholds rings below the threshold", () => {
    expect(hasRings(RING_THRESHOLD - 1)).toBe(false);
  });

  it("grants rings at and above the threshold", () => {
    expect(hasRings(RING_THRESHOLD)).toBe(true);
    expect(hasRings(RING_THRESHOLD + 6)).toBe(true);
  });
});

describe("subtaskHeaviness", () => {
  it("treats an empty subtask as weightless", () => {
    expect(subtaskHeaviness("")).toBe(0);
    expect(subtaskHeaviness(undefined)).toBe(0);
  });

  it("grows with how much the subtask says", () => {
    expect(subtaskHeaviness("Ship it")).toBeLessThan(
      subtaskHeaviness("Ship it once notarization clears and the dmg is stapled")
    );
  });

  it("stays within 0..1 however long the text runs", () => {
    const long = subtaskHeaviness("x".repeat(5000));
    expect(long).toBeLessThanOrEqual(1);
    expect(long).toBeGreaterThan(0.9);
  });
});

describe("moonOrbitAngle heaviness", () => {
  it("turns a heavy moon more slowly than a weightless one", () => {
    const period = orbitPeriodMs(3);
    const light = moonOrbitAngle(0, 3, period, 0) - moonOrbitAngle(0, 3, 0, 0);
    const heavy = moonOrbitAngle(0, 3, period, 1) - moonOrbitAngle(0, 3, 0, 1);
    expect(heavy).toBeLessThan(light);
  });

  it("still starts every moon from its own place on the ring", () => {
    const gap = moonOrbitAngle(1, 4, 0, 0.8) - moonOrbitAngle(0, 4, 0, 0.8);
    expect(gap).toBeCloseTo(Math.PI / 2, 6);
  });
});

describe("helios", () => {
  it("ranks the rings new, then moving, then finished", () => {
    expect(heliosRadius("TO-DO")).toBeLessThan(heliosRadius("IN PROGRESS"));
    expect(heliosRadius("IN PROGRESS")).toBeLessThan(heliosRadius("DONE"));
  });

  it("falls back to the inner ring for an unknown status", () => {
    expect(heliosRadius("WHATEVER")).toBe(heliosRadius("TO-DO"));
  });

  it("makes a heavier planet lap the sun more slowly", () => {
    expect(heliosOrbitPeriodMs(0)).toBeLessThan(heliosOrbitPeriodMs(6));
  });

  it("caps the period so a huge task still moves", () => {
    expect(heliosOrbitPeriodMs(200)).toBe(heliosOrbitPeriodMs(999));
  });
});
