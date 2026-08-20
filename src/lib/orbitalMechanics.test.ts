import { describe, expect, it } from "vitest";
import {
  heliosOrbitPeriodMs,
  heliosPhase,
  heliosPosition,
  heliosRadius,
  moonOrbitAngle,
  orbitPeriodMs,
  planetScale,
  moonShells,
  shellOf,
  shellOrientation,
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
    expect(planetScale(500)).toBeLessThanOrEqual(3.4);
  });
});

describe("moonShells", () => {
  it("has no shells with nothing in orbit", () => {
    expect(moonShells(0)).toEqual([]);
  });

  it("keeps a small count on one ring", () => {
    expect(moonShells(1)).toEqual([1]);
    expect(moonShells(3)).toEqual([3]);
  });

  it("splits evenly rather than stacking the inner ring", () => {
    expect(moonShells(4)).toEqual([2, 2]);
    expect(moonShells(6)).toEqual([3, 3]);
    expect(moonShells(9)).toEqual([3, 3, 3]);
    expect(moonShells(12)).toEqual([4, 4, 4]);
  });

  it("never lets two rings differ by more than one", () => {
    for (const n of [5, 7, 8, 10, 11, 13, 20, 31]) {
      const shells = moonShells(n);
      expect(Math.max(...shells) - Math.min(...shells)).toBeLessThanOrEqual(1);
    }
  });

  it("always accounts for every moon", () => {
    for (const n of [1, 4, 7, 15, 29, 60]) {
      expect(moonShells(n).reduce((a, b) => a + b, 0)).toBe(n);
    }
  });

  it("ignores nonsense counts", () => {
    expect(moonShells(-3)).toEqual([]);
    expect(moonShells(Number.NaN)).toEqual([]);
  });
});

describe("shellOf", () => {
  it("maps each moon index to the shell holding it", () => {
    // Six moons split [3, 3]: indices 0-2 inner, 3-5 outer.
    expect(shellOf(0, 6)).toBe(0);
    expect(shellOf(2, 6)).toBe(0);
    expect(shellOf(3, 6)).toBe(1);
    expect(shellOf(5, 6)).toBe(1);
  });

  it("keeps a lone moon on the inner shell", () => {
    expect(shellOf(0, 1)).toBe(0);
  });
});

describe("shellOrientation", () => {
  it("juxtaposes the rings rather than stacking them flat", () => {
    const a = shellOrientation(0);
    const b = shellOrientation(1);
    expect(a).not.toBeCloseTo(b, 3);
  });

  it("stands the second ring up against the first", () => {
    // Roughly a quarter turn apart reads as vertical against horizontal.
    const delta = Math.abs(shellOrientation(1) - shellOrientation(0));
    expect(delta).toBeGreaterThan(Math.PI / 4);
  });

  it("is stable and finite for any shell", () => {
    for (const i of [0, 1, 2, 3, 7, 40]) {
      expect(Number.isFinite(shellOrientation(i))).toBe(true);
      expect(shellOrientation(i)).toBe(shellOrientation(i));
    }
  });
});

describe("planetScale as an atom", () => {
  it("separates sizes dramatically, the way planets actually differ", () => {
    // A one-subtask world and a ten-subtask world should not look alike.
    expect(planetScale(10) / planetScale(1)).toBeGreaterThan(1.7);
  });

  it("still never shrinks below its natural size", () => {
    expect(planetScale(0)).toBe(1);
    expect(planetScale(1)).toBeGreaterThan(1);
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

describe("heliosPhase", () => {
  it("is stable for the same id", () => {
    expect(heliosPhase("task-42")).toBe(heliosPhase("task-42"));
  });

  it("spreads different ids around the circle", () => {
    const phases = ["a", "b", "c", "d", "e", "f"].map(heliosPhase);
    expect(new Set(phases).size).toBe(phases.length);
    for (const p of phases) {
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThan(Math.PI * 2);
    }
  });

  it("handles an empty id without producing NaN", () => {
    expect(Number.isFinite(heliosPhase(""))).toBe(true);
  });
});

describe("heliosPosition", () => {
  it("puts a task on its status ring", () => {
    const { x, y } = heliosPosition("t1", "IN PROGRESS", 0, 0);
    expect(Math.hypot(x, y)).toBeCloseTo(heliosRadius("IN PROGRESS"), 5);
  });

  it("comes back to the same point after one lap", () => {
    const period = heliosOrbitPeriodMs(2);
    const a = heliosPosition("t1", "TO-DO", 0, 2);
    const b = heliosPosition("t1", "TO-DO", period, 2);
    expect(b.x).toBeCloseTo(a.x, 4);
    expect(b.y).toBeCloseTo(a.y, 4);
  });

  it("spaces planets that share a ring evenly around it", () => {
    const total = 4;
    const angles = Array.from({ length: total }, (_, i) =>
      heliosPosition(`t${i}`, "TO-DO", 0, 0, { index: i, total })
    ).map((p) => Math.atan2(p.y, p.x));
    // No two planets should end up sitting on top of one another.
    for (let i = 0; i < angles.length; i += 1) {
      for (let j = i + 1; j < angles.length; j += 1) {
        const gap = Math.abs(angles[i] - angles[j]) % (Math.PI * 2);
        expect(Math.min(gap, Math.PI * 2 - gap)).toBeGreaterThan(0.3);
      }
    }
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

  it("turns a heavy moon more slowly than a weightless one", () => {
    const period = orbitPeriodMs(3);
    const light = moonOrbitAngle(0, 3, period, 0) - moonOrbitAngle(0, 3, 0, 0);
    const heavy = moonOrbitAngle(0, 3, period, 1) - moonOrbitAngle(0, 3, 0, 1);
    expect(heavy).toBeLessThan(light);
  });
});
