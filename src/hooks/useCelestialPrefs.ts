import { useSyncExternalStore } from "react";
import {
  getCelestialPrefs,
  setCelestialPrefs,
  subscribeCelestialPrefs,
} from "../lib/celestialStore";
import type { CelestialPrefs } from "../lib/celestialPrefs";

/**
 * Reads the celestial theme and re-renders when any surface changes it, so the
 * column titles, the chip stars and the galaxy stay in step.
 */
export const useCelestialPrefs = (): [CelestialPrefs, (next: CelestialPrefs) => void] => {
  const prefs = useSyncExternalStore(
    subscribeCelestialPrefs,
    getCelestialPrefs,
    getCelestialPrefs
  );
  return [prefs, setCelestialPrefs];
};
