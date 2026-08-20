/**
 * Which body each column flies, and what colour the subtask stars burn.
 *
 * Accents are sampled from the sprite art itself and lifted into a readable
 * range, so a column title is genuinely the colour of the planet orbiting in
 * the galaxy rather than an approximation someone picked by eye.
 */

export type StatusKey = "TO-DO" | "IN PROGRESS" | "DONE";

export const STATUS_KEYS: readonly StatusKey[] = ["TO-DO", "IN PROGRESS", "DONE"];

export type SkinId =
  | "moon0"
  | "moon1"
  | "moon2"
  | "moon3"
  | "moon4"
  | "moon5"
  | "moon6";

export interface Skin {
  id: SkinId;
  label: string;
  /** Lifted from the sprite's own palette; safe on the dark background. */
  accent: string;
}

/**
 * Seven bodies, seven colours -- one per moon sprite, spaced around the wheel
 * so no two columns can be mistaken for each other at a glance.
 */
export const SKINS: readonly Skin[] = [
  { id: "moon5", label: "Indigo", accent: "#6f97e8" },
  { id: "moon2", label: "Moss", accent: "#7fd08a" },
  { id: "moon6", label: "Amber", accent: "#e6ad4b" },
  { id: "moon3", label: "Copper", accent: "#ff9d3c" },
  { id: "moon1", label: "Rust", accent: "#e8654a" },
  { id: "moon0", label: "Rose", accent: "#f4699b" },
  { id: "moon4", label: "Violet", accent: "#b98ede" },
] as const;

const SKIN_BY_ID = new Map<string, Skin>(SKINS.map((skin) => [skin.id, skin]));

/** Never returns undefined -- an unknown id falls back to the first skin. */
export const skinById = (id: string): Skin => SKIN_BY_ID.get(id) ?? SKINS[0];

export interface CelestialPrefs {
  statusSkins: Record<StatusKey, SkinId>;
  /** Colour the subtask moons orbiting a column's planets. */
  moonTints: Record<StatusKey, string>;
  /** Fill for the subtask starbursts on board chips. */
  starColor: string;
}

export const DEFAULT_CELESTIAL_PREFS: CelestialPrefs = {
  // Keeps the board's original reading: cool for waiting, warm for moving,
  // green for finished.
  statusSkins: {
    "TO-DO": "moon5",
    "IN PROGRESS": "moon6",
    DONE: "moon2",
  },
  // The warm gold moons have always used; changing it is opt-in.
  moonTints: {
    "TO-DO": "#f7e28b",
    "IN PROGRESS": "#f7e28b",
    DONE: "#f7e28b",
  },
  starColor: "#ffce5c",
};

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Repairs rather than rejects, matching how the board loader treats storage:
 * one bad field must not cost the user every other choice they made.
 */
export const normalizeCelestialPrefs = (raw: unknown): CelestialPrefs => {
  if (!isRecord(raw)) return { ...DEFAULT_CELESTIAL_PREFS };

  const skinsRaw = isRecord(raw.statusSkins) ? raw.statusSkins : {};
  const statusSkins = {} as Record<StatusKey, SkinId>;
  for (const key of STATUS_KEYS) {
    const candidate = skinsRaw[key];
    statusSkins[key] =
      typeof candidate === "string" && SKIN_BY_ID.has(candidate)
        ? (candidate as SkinId)
        : DEFAULT_CELESTIAL_PREFS.statusSkins[key];
  }

  const tintsRaw = isRecord(raw.moonTints) ? raw.moonTints : {};
  const moonTints = {} as Record<StatusKey, string>;
  for (const key of STATUS_KEYS) {
    const candidate = tintsRaw[key];
    moonTints[key] =
      typeof candidate === "string" && HEX_COLOR.test(candidate)
        ? candidate
        : DEFAULT_CELESTIAL_PREFS.moonTints[key];
  }

  const colorRaw = raw.starColor;
  const starColor =
    typeof colorRaw === "string" && HEX_COLOR.test(colorRaw)
      ? colorRaw
      : DEFAULT_CELESTIAL_PREFS.starColor;

  return { statusSkins, moonTints, starColor };
};

export const accentForStatus = (prefs: CelestialPrefs, status: StatusKey): string =>
  skinById(prefs.statusSkins[status]).accent;

export const moonTintForStatus = (prefs: CelestialPrefs, status: StatusKey): string =>
  prefs.moonTints[status] ?? DEFAULT_CELESTIAL_PREFS.moonTints[status];

const pick = <T,>(items: readonly T[], random: () => number): T =>
  items[Math.min(items.length - 1, Math.floor(random() * items.length))];

/**
 * Rolls a whole theme. Takes its randomness as an argument so a test can pin
 * it down -- same rule as the pure functions that take `now`.
 *
 * Each column gets a different body: three planets in the same colour would
 * defeat the point of colouring them at all.
 */
export const randomizeCelestialPrefs = (
  random: () => number = Math.random
): CelestialPrefs => {
  const remaining = [...SKINS];
  const statusSkins = {} as Record<StatusKey, SkinId>;
  for (const key of STATUS_KEYS) {
    const choice = pick(remaining, random);
    statusSkins[key] = choice.id;
    remaining.splice(remaining.indexOf(choice), 1);
  }

  const moonTints = {} as Record<StatusKey, string>;
  for (const key of STATUS_KEYS) {
    moonTints[key] = pick(SKINS, random).accent;
  }

  return { statusSkins, moonTints, starColor: pick(SKINS, random).accent };
};
