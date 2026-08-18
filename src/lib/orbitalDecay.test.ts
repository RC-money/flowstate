import { describe, expect, test } from "vitest";
import { decayLevel, GRACE_DAYS, FULL_DECAY_DAYS } from "./orbitalDecay";

const DAY = 86_400_000;
const NOW = 1_755_500_000_000;

describe("decayLevel", () => {
  test("fresh work does not decay", () => {
    expect(decayLevel(NOW - DAY, NOW)).toBe(0);
  });

  test("stays zero through the whole grace period", () => {
    expect(decayLevel(NOW - GRACE_DAYS * DAY, NOW)).toBe(0);
  });

  test("begins after the grace period", () => {
    const level = decayLevel(NOW - (GRACE_DAYS + 1) * DAY, NOW);
    expect(level).toBeGreaterThan(0);
    expect(level).toBeLessThan(0.2);
  });

  test("reaches full decay at the horizon", () => {
    expect(decayLevel(NOW - FULL_DECAY_DAYS * DAY, NOW)).toBe(1);
  });

  test("clamps beyond the horizon", () => {
    expect(decayLevel(NOW - 90 * DAY, NOW)).toBe(1);
  });

  test("is monotonic between grace and horizon", () => {
    let prev = -1;
    for (let d = 0; d <= FULL_DECAY_DAYS + 2; d++) {
      const level = decayLevel(NOW - d * DAY, NOW);
      expect(level).toBeGreaterThanOrEqual(prev);
      prev = level;
    }
  });

  test("a future updatedAt reads as fresh, not negative", () => {
    expect(decayLevel(NOW + DAY, NOW)).toBe(0);
  });

  test("garbage input reads as fresh rather than decayed", () => {
    // A missing or corrupt timestamp must never shove a task toward the
    // Dark Forest -- decay is earned by real neglect only.
    expect(decayLevel(NaN, NOW)).toBe(0);
    expect(decayLevel(undefined as unknown as number, NOW)).toBe(0);
  });
});
