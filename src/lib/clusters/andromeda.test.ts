import { describe, expect, it } from "vitest";
import {
  ANDROMEDA_ARMS,
  andromedaPoints,
  projectToDisc,
  ringSlot,
  spiralPoint,
} from "./andromeda";
import { makeCluster, type Cluster } from "./clusters";

const NOW = 1_700_000_000_000;
const DAY = 86_400_000;

const cluster = (id: string, over: Partial<Cluster> = {}): Cluster => ({
  ...makeCluster(id, NOW, id),
  ...over,
});

describe("spiralPoint", () => {
  it("puts a point at the radius it was given", () => {
    const { x, y } = spiralPoint({ arm: 0, radius: 0.6 });

    expect(Math.hypot(x, y)).toBeCloseTo(0.6, 6);
  });

  it("is the same point every time", () => {
    expect(spiralPoint({ arm: 2, radius: 0.8 })).toEqual(spiralPoint({ arm: 2, radius: 0.8 }));
  });

  it("puts different arms in different directions at the same radius", () => {
    const a = spiralPoint({ arm: 0, radius: 0.6 });
    const b = spiralPoint({ arm: 1, radius: 0.6 });

    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(0.2);
  });

  it("sweeps the arm around as it runs outward, which is what makes it a spiral", () => {
    const inner = spiralPoint({ arm: 0, radius: 0.35 });
    const outer = spiralPoint({ arm: 0, radius: 1 });
    const angle = (p: { x: number; y: number }) => Math.atan2(p.y, p.x);

    expect(Math.abs(angle(outer) - angle(inner))).toBeGreaterThan(0.3);
  });

  it("keeps every arm inside the disc", () => {
    for (let arm = 0; arm < ANDROMEDA_ARMS; arm += 1) {
      for (const radius of [0.3, 0.55, 0.8, 1]) {
        const { x, y } = spiralPoint({ arm, radius });

        expect(Math.hypot(x, y)).toBeLessThanOrEqual(1.0001);
      }
    }
  });
});

describe("andromedaPoints", () => {
  it("gives every live cluster a point", () => {
    const points = andromedaPoints([cluster("a"), cluster("b")], NOW);

    expect(points.map((p) => p.id)).toEqual(["a", "b"]);
  });

  it("puts an ethered cluster out beyond the disc", () => {
    const points = andromedaPoints(
      [cluster("live"), cluster("gone", { etheredAt: NOW - DAY })],
      NOW
    );
    const gone = points.find((p) => p.id === "gone")!;
    const live = points.find((p) => p.id === "live")!;

    expect(gone.ethered).toBe(true);
    expect(Math.hypot(gone.x, gone.y)).toBeGreaterThan(1);
    expect(Math.hypot(live.x, live.y)).toBeLessThanOrEqual(1);
  });

  it("names an ethered cluster the way a catalogue would", () => {
    const points = andromedaPoints([cluster("gone", { etheredAt: NOW })], NOW);

    expect(points[0].catalog).toMatch(/^(NGC|IC|Messier|Abell) \d{4}$/);
  });

  it("leaves a live cluster uncatalogued -- it is still just its name", () => {
    expect(andromedaPoints([cluster("live")], NOW)[0].catalog).toBeUndefined();
  });

  it("dims a cluster nobody has touched in weeks", () => {
    const fresh = andromedaPoints([cluster("fresh", { createdAt: NOW })], NOW)[0];
    const stale = andromedaPoints(
      [{ ...cluster("stale"), createdAt: NOW - 40 * DAY }],
      NOW,
      { "stale": NOW - 40 * DAY }
    )[0];

    expect(stale.brightness).toBeLessThan(fresh.brightness);
  });

  it("never dims a point out of sight completely", () => {
    const points = andromedaPoints([cluster("ancient")], NOW, {
      ancient: NOW - 400 * DAY,
    });

    expect(points[0].brightness).toBeGreaterThan(0.15);
  });

  it("grows a point with the work inside it", () => {
    const small = andromedaPoints([cluster("a")], NOW, {}, { a: 1 })[0];
    const big = andromedaPoints([cluster("a")], NOW, {}, { a: 20 })[0];

    expect(big.size).toBeGreaterThan(small.size);
  });

  it("keeps the biggest cluster from swallowing the disc", () => {
    const huge = andromedaPoints([cluster("a")], NOW, {}, { a: 5000 })[0];

    expect(huge.size).toBeLessThanOrEqual(1);
  });

  it("is the same map every time for the same clusters", () => {
    const clusters = [cluster("a"), cluster("b", { etheredAt: NOW })];

    expect(andromedaPoints(clusters, NOW)).toEqual(andromedaPoints(clusters, NOW));
  });
});

describe("ringSlot", () => {
  it("spaces neighbours apart rather than letting them clump", () => {
    const slots = [0, 1, 2, 3].map((i) => ringSlot("c", i, 4));
    const angles = slots.map((slot) => slot.angle).sort((a, b) => a - b);

    for (let i = 1; i < angles.length; i += 1) {
      expect(angles[i] - angles[i - 1]).toBeGreaterThan(0.5);
    }
  });

  it("keeps every cluster out at the rim, clear of the middle", () => {
    for (let i = 0; i < 12; i += 1) {
      const { radius } = ringSlot(`cluster_${i}`, i, 12);

      expect(radius).toBeGreaterThanOrEqual(0.62);
      expect(radius).toBeLessThanOrEqual(0.95);
    }
  });

  it("gives the same cluster the same place every time", () => {
    expect(ringSlot("c_abc", 2, 5)).toEqual(ringSlot("c_abc", 2, 5));
  });

  it("offsets neighbours by their own id so the ring is not a clock face", () => {
    expect(ringSlot("a", 0, 4).radius).not.toBe(ringSlot("b", 0, 4).radius);
  });

  it("survives a ring of one", () => {
    const { angle, radius } = ringSlot("only", 0, 1);

    expect(Number.isFinite(angle)).toBe(true);
    expect(radius).toBeGreaterThan(0);
  });
});

describe("projectToDisc", () => {
  it("leaves the core at the centre however far the galaxy has turned", () => {
    expect(projectToDisc({ x: 0, y: 0 }, 0)).toEqual({ x: 0, y: 0 });
    expect(projectToDisc({ x: 0, y: 0 }, 137)).toEqual({ x: 0, y: 0 });
  });

  it("flattens the disc, so nothing rises as far as it runs across", () => {
    const across = projectToDisc({ x: 1, y: 0 }, 0);
    const up = projectToDisc({ x: 0, y: 1 }, 0);

    expect(Math.abs(up.y)).toBeLessThan(Math.abs(across.x));
  });

  it("turns the whole disc as it spins", () => {
    const still = projectToDisc({ x: 1, y: 0 }, 0);
    const turned = projectToDisc({ x: 1, y: 0 }, 90);

    expect(Math.hypot(still.x - turned.x, still.y - turned.y)).toBeGreaterThan(0.4);
  });

  it("keeps a point on the rim inside the projection", () => {
    for (const angle of [0, 1, 2, 3, 4, 5]) {
      const point = projectToDisc({ x: Math.cos(angle), y: Math.sin(angle) }, angle * 40);

      expect(Math.hypot(point.x, point.y)).toBeLessThanOrEqual(1.0001);
    }
  });

  it("is the same projection every time", () => {
    expect(projectToDisc({ x: 0.7, y: -0.3 }, 42)).toEqual(
      projectToDisc({ x: 0.7, y: -0.3 }, 42)
    );
  });
});
