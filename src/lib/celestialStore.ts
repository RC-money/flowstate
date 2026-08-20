import {
  DEFAULT_CELESTIAL_PREFS,
  normalizeCelestialPrefs,
  type CelestialPrefs,
} from "./celestialPrefs";

/**
 * A tiny external store rather than context, because the canvas renderer
 * (`graphStyles.drawNode`) is not a component and still has to read the
 * current skins on every frame. Components subscribe; the canvas just calls
 * getCelestialPrefs().
 */

const STORAGE_KEY = "flowstate:v1:celestial";

const read = (): CelestialPrefs => {
  if (typeof localStorage === "undefined") return { ...DEFAULT_CELESTIAL_PREFS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_CELESTIAL_PREFS };
    return normalizeCelestialPrefs(JSON.parse(raw));
  } catch {
    // A corrupt blob costs the user their theme, never their board.
    return { ...DEFAULT_CELESTIAL_PREFS };
  }
};

let current: CelestialPrefs = read();
const listeners = new Set<() => void>();

export const getCelestialPrefs = (): CelestialPrefs => current;

export const setCelestialPrefs = (next: CelestialPrefs): void => {
  current = normalizeCelestialPrefs(next);
  try {
    localStorage?.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // Private browsing and quota failures are not worth breaking the UI over.
  }
  listeners.forEach((listener) => listener());
};

export const subscribeCelestialPrefs = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
