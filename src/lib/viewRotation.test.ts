import { describe, expect, it } from "vitest";
import {
  FLOW_PRESETS,
  flowRotationAt,
  IDENTITY_ROTATION,
  isIdentityRotation,
  rotatePoint,
  type ViewRotation,
} from "./viewRotation";

const deg = (spin: number, tilt: number, yaw: number): ViewRotation => ({ spin, tilt, yaw });

describe("rotatePoint", () => {
  it("leaves a point alone at identity", () => {
    const p = rotatePoint({ x: 120, y: -40, z: 0 }, IDENTITY_ROTATION);
    expect(p.x).toBeCloseTo(120, 6);
    expect(p.y).toBeCloseTo(-40, 6);
  });

  it("spins a point a quarter turn around the view axis", () => {
    const p = rotatePoint({ x: 100, y: 0, z: 0 }, deg(90, 0, 0));
    expect(p.x).toBeCloseTo(0, 6);
    expect(p.y).toBeCloseTo(100, 6);
  });

  it("flattens the vertical when tilted edge-on", () => {
    // Tilting 90 degrees turns the plane edge-on, so y collapses toward zero.
    const p = rotatePoint({ x: 0, y: 100, z: 0 }, deg(0, 90, 0));
    expect(p.y).toBeCloseTo(0, 6);
  });

  it("swings horizontal spread away under yaw", () => {
    const p = rotatePoint({ x: 100, y: 0, z: 0 }, deg(0, 0, 90));
    expect(p.x).toBeCloseTo(0, 6);
  });

  it("preserves length -- rotation never scales the system", () => {
    const start = { x: 90, y: 40, z: 0 };
    const p = rotatePoint(start, deg(35, 50, 20));
    const before = Math.hypot(start.x, start.y, start.z);
    const after = Math.hypot(p.x, p.y, p.z);
    expect(after).toBeCloseTo(before, 6);
  });

  it("is stable for a full turn on every axis", () => {
    const p = rotatePoint({ x: 70, y: 25, z: 0 }, deg(360, 360, 360));
    expect(p.x).toBeCloseTo(70, 5);
    expect(p.y).toBeCloseTo(25, 5);
  });
});

describe("isIdentityRotation", () => {
  it("recognises the resting position", () => {
    expect(isIdentityRotation(IDENTITY_ROTATION)).toBe(true);
    expect(isIdentityRotation(deg(0, 0, 0))).toBe(true);
  });

  it("notices any axis being turned", () => {
    expect(isIdentityRotation(deg(1, 0, 0))).toBe(false);
    expect(isIdentityRotation(deg(0, -2, 0))).toBe(false);
    expect(isIdentityRotation(deg(0, 0, 5))).toBe(false);
  });
});

describe("flowRotationAt", () => {
  it("offers more than one configuration to move between", () => {
    expect(FLOW_PRESETS.length).toBeGreaterThan(2);
  });

  it("sits on the first preset at the start", () => {
    const r = flowRotationAt(0, 10_000);
    expect(r.spin).toBeCloseTo(FLOW_PRESETS[0].spin, 4);
    expect(r.tilt).toBeCloseTo(FLOW_PRESETS[0].tilt, 4);
  });

  it("arrives exactly on the next preset after one leg", () => {
    const leg = 10_000;
    const r = flowRotationAt(leg, leg);
    expect(r.spin).toBeCloseTo(FLOW_PRESETS[1].spin, 4);
    expect(r.tilt).toBeCloseTo(FLOW_PRESETS[1].tilt, 4);
  });

  it("stays between the two presets it is travelling between", () => {
    const leg = 10_000;
    const r = flowRotationAt(leg * 0.5, leg);
    const lo = Math.min(FLOW_PRESETS[0].tilt, FLOW_PRESETS[1].tilt);
    const hi = Math.max(FLOW_PRESETS[0].tilt, FLOW_PRESETS[1].tilt);
    expect(r.tilt).toBeGreaterThanOrEqual(lo);
    expect(r.tilt).toBeLessThanOrEqual(hi);
  });

  it("loops back around rather than running off the end", () => {
    const leg = 10_000;
    const full = leg * FLOW_PRESETS.length;
    const start = flowRotationAt(0, leg);
    const looped = flowRotationAt(full, leg);
    expect(looped.spin).toBeCloseTo(start.spin, 4);
    expect(looped.tilt).toBeCloseTo(start.tilt, 4);
  });

  it("never returns a non-finite angle", () => {
    for (const t of [0, 1, 5555, 123456]) {
      const r = flowRotationAt(t, 9000);
      expect(Number.isFinite(r.spin)).toBe(true);
      expect(Number.isFinite(r.tilt)).toBe(true);
      expect(Number.isFinite(r.yaw)).toBe(true);
    }
  });
});
