/**
 * Orbital decay: neglect made visible without shame. Instead of a red
 * OVERDUE badge, an untouched task slowly dims and drifts toward the edge
 * of the galaxy, and at full decay is suggested for setting aside --
 * never an automatic archive. The information is the same; the tone is not.
 */

const DAY = 86_400_000;

/** Days a task can rest untouched before decay begins. */
export const GRACE_DAYS = 3;

/** Days of neglect at which decay is complete. */
export const FULL_DECAY_DAYS = 14;

/** Decay at or above this level suggests setting the task aside. */
export const DARK_FOREST_THRESHOLD = 0.85;

/**
 * 0 (fresh) to 1 (fully decayed), easing in quadratically so the first days
 * past grace barely register and long neglect accelerates. Corrupt or future
 * timestamps read as fresh -- decay must be earned by real neglect only.
 */
export const decayLevel = (updatedAt: number, now: number): number => {
  if (typeof updatedAt !== "number" || !Number.isFinite(updatedAt)) return 0;
  const idleDays = (now - updatedAt) / DAY;
  if (idleDays <= GRACE_DAYS) return 0;
  const progress = Math.min(1, (idleDays - GRACE_DAYS) / (FULL_DECAY_DAYS - GRACE_DAYS));
  return progress * progress;
};
