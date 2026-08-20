import { describe, expect, it } from "vitest";
import { detectSwell, initialSwellState, type SwellState } from "./swell";

const OPTS = { alpha: 0.1, ratio: 1.4, minEnergy: 0.08, cooldownMs: 8000 };

const settle = (state: SwellState, rms: number, times: number, startNow: number) => {
  let current = state;
  for (let i = 0; i < times; i += 1) {
    current = detectSwell(current, rms, startNow + i * 100, OPTS).state;
  }
  return current;
};

describe("detectSwell", () => {
  it("never swells on the very first sample", () => {
    const { swell } = detectSwell(initialSwellState(), 0.9, 0, OPTS);
    expect(swell).toBe(false);
  });

  it("stays quiet on a steady signal", () => {
    let state = initialSwellState();
    for (let i = 0; i < 50; i += 1) {
      const result = detectSwell(state, 0.2, i * 100, OPTS);
      expect(result.swell).toBe(false);
      state = result.state;
    }
  });

  it("fires when the signal jumps well above its baseline", () => {
    const state = settle(initialSwellState(), 0.1, 30, 0);
    const { swell } = detectSwell(state, 0.3, 3000, OPTS);
    expect(swell).toBe(true);
  });

  it("ignores jumps that stay under the energy floor", () => {
    const state = settle(initialSwellState(), 0.02, 30, 0);
    const { swell } = detectSwell(state, 0.06, 3000, OPTS);
    expect(swell).toBe(false);
  });

  it("respects the cooldown, then can fire again", () => {
    let state = settle(initialSwellState(), 0.1, 30, 0);
    const first = detectSwell(state, 0.4, 3000, OPTS);
    expect(first.swell).toBe(true);
    state = settle(first.state, 0.1, 10, 3100);
    const tooSoon = detectSwell(state, 0.4, 6000, OPTS);
    expect(tooSoon.swell).toBe(false);
    state = settle(tooSoon.state, 0.1, 10, 6100);
    const later = detectSwell(state, 0.4, 12000, OPTS);
    expect(later.swell).toBe(true);
  });

  it("tracks a slow crescendo without firing", () => {
    let state = settle(initialSwellState(), 0.1, 30, 0);
    let fired = false;
    let rms = 0.1;
    for (let i = 0; i < 200; i += 1) {
      rms += 0.001;
      const result = detectSwell(state, rms, 3000 + i * 100, OPTS);
      fired = fired || result.swell;
      state = result.state;
    }
    expect(fired).toBe(false);
  });
});
